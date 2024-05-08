//! This module implements the web API for the iSCSI handling of the storage service.
//!
//! The module offers two public functions:
//!
//! * `iscsi_service` which returns the Axum service.
//! * `iscsi_stream` which offers an stream that emits the iSCSI-related events coming from D-Bus.

use crate::{
    error::Error,
    web::{common::EventStreams, Event},
};
use agama_lib::{
    dbus::{get_optional_property, to_owned_hash},
    error::ServiceError,
    storage::{
        client::iscsi::{ISCSIAuth, ISCSINode, Initiator, LoginResult},
        proxies::InitiatorProxy,
        ISCSIClient,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

mod stream;
use stream::ISCSINodeStream;
use tokio_stream::{Stream, StreamExt};
use zbus::fdo::{PropertiesChanged, PropertiesProxy};

/// Returns the stream of iSCSI-related events.
///
/// The stream combines the following events:
///
/// * Changes on the iSCSI nodes collection.
/// * Changes to the initiator (name or ibft).
///
/// * `dbus`: D-Bus connection to use.
pub async fn iscsi_stream(dbus: &zbus::Connection) -> Result<EventStreams, Error> {
    let stream: EventStreams = vec![
        ("iscsi_nodes", Box::pin(ISCSINodeStream::new(dbus).await?)),
        ("initiator", Box::pin(initiator_stream(dbus).await?)),
    ];
    Ok(stream)
}

async fn initiator_stream(
    dbus: &zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = PropertiesProxy::builder(dbus)
        .destination("org.opensuse.Agama.Storage1")?
        .path("/org/opensuse/Agama/Storage1")?
        .build()
        .await?;
    let stream = proxy
        .receive_properties_changed()
        .await?
        .filter_map(|change| match handle_initiator_change(change) {
            Ok(event) => Some(event),
            Err(error) => {
                log::warn!("Could not read the initiator change: {}", error);
                None
            }
        });
    Ok(stream)
}

fn handle_initiator_change(change: PropertiesChanged) -> Result<Event, ServiceError> {
    let args = change.args()?;
    let changes = to_owned_hash(args.changed_properties());
    let name = get_optional_property(&changes, "InitiatorName")?;
    let ibft = get_optional_property(&changes, "IBFT")?;
    Ok(Event::ISCSIInitiatorChanged { ibft, name })
}

#[derive(Clone)]
struct ISCSIState<'a> {
    client: ISCSIClient<'a>,
}

/// Sets up and returns the Axum service for the iSCSI part of the storage module.
///
/// It acts as a proxy to Agama D-Bus service.
///
/// * `dbus`: D-Bus connection to use.
pub async fn iscsi_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = ISCSIClient::new(dbus.clone()).await?;
    let state = ISCSIState { client };
    let router = Router::new()
        .route("/initiator", get(initiator).patch(update_initiator))
        .route("/nodes", get(nodes))
        .route("/nodes/:id", delete(delete_node).patch(update_node))
        .route("/nodes/:id/login", post(login_node))
        .route("/nodes/:id/logout", post(logout_node))
        .route("/discover", post(discover))
        .with_state(state);
    Ok(router)
}

async fn initiator(State(state): State<ISCSIState<'_>>) -> Result<Json<Initiator>, Error> {
    let initiator = state.client.get_initiator().await?;
    Ok(Json(initiator))
}

#[derive(Deserialize)]
struct InitiatorParams {
    name: String,
}

async fn update_initiator(
    State(state): State<ISCSIState<'_>>,
    Json(params): Json<InitiatorParams>,
) -> Result<impl IntoResponse, Error> {
    state.client.set_initiator_name(&params.name).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn nodes(State(state): State<ISCSIState<'_>>) -> Result<Json<Vec<ISCSINode>>, Error> {
    let nodes = state.client.get_nodes().await?;
    Ok(Json(nodes))
}

#[derive(Deserialize)]
struct DiscoverParams {
    address: String,
    port: u32,
    #[serde(default)]
    options: ISCSIAuth,
}

async fn discover(
    State(state): State<ISCSIState<'_>>,
    Json(params): Json<DiscoverParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state
        .client
        .discover(&params.address, params.port, params.options)
        .await?;
    if result {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::BAD_REQUEST)
    }
}

#[derive(Deserialize)]
struct NodeParams {
    startup: String,
}

async fn update_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
    Json(params): Json<NodeParams>,
) -> Result<impl IntoResponse, Error> {
    state.client.set_startup(id, &params.startup).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    state.client.delete_node(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct LoginParams {
    #[serde(flatten)]
    auth: ISCSIAuth,
    startup: String,
}

#[derive(Serialize)]
struct LoginError {
    code: LoginResult,
}

async fn login_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
    Json(params): Json<LoginParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state.client.login(id, params.auth, params.startup).await?;
    match result {
        LoginResult::Success => Ok((StatusCode::NO_CONTENT, ().into_response())),
        error => Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(error).into_response(),
        )),
    }
}

async fn logout_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    if state.client.logout(id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::UNPROCESSABLE_ENTITY)
    }
}

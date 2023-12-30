/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// @ts-check

import React, { useState } from "react";
import { sprintf } from "sprintf-js";

import { Icon } from '~/components/layout';
import { IssuesDialog } from "~/components/core";
import { n_ } from "~/i18n";

/**
 * Displays validation errors
 *
 * When there is only one error, it displays its message. Otherwise, it displays a generic message
 * which can be clicked and more error details will be shown in a popup dialog.
 *
 * @component
 *
 * @todo This component might be more generic.
 *
 * @param {object} props
 * @param {string} props.sectionId - Name of the section which is displaying errors. (product, software, storage, ...)
 * @param {import("~/client/mixins").ValidationError[]} props.errors - Validation errors
 */
const ValidationErrors = ({ errors, sectionId }) => {
  const [showIssuesPopUp, setshowIssuesPopUp] = useState(false);

  if (!errors || errors.length === 0) return null;

  const warningIcon = <Icon name="warning" size="xxs" />;

  if (errors.length === 1) {
    return (
      <div className="color-warn">{warningIcon} {errors[0].message}</div>
    );
  } else {
    return (
      <>
        <div className="color-warn">
          <button
            style={{ padding: "0", borderBottom: "1px solid" }}
            className="plain-control color-warn"
            onClick={() => setshowIssuesPopUp(true)}
          >
            {
              sprintf(
                // TRANSLATORS: %d is replaced with the number of errors found
                n_("%d error found", "%d errors found", errors.length),
                errors.length
              )
            }
          </button>

          <IssuesDialog
            isOpen={showIssuesPopUp}
            onClose={() => setshowIssuesPopUp(false)}
            sectionId={sectionId}
          />
        </div>
      </>
    );
  }
};

export default ValidationErrors;

/*
 * Copyright (c) [2022] SUSE LLC
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

import StorageClient from "./storage";

// NOTE: should we export them?
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_ACTIONS_IFACE = "org.opensuse.DInstaller.Storage.Actions1";

const dbusClient = {};
const storageProposalProxy = {
  wait: jest.fn(),
  AvailableDevices: [
    ["/dev/sda", "/dev/sda, 950 GiB, Windows"],
    ["/dev/sdb", "/dev/sdb, 500 GiB"]
  ],
  CandidateDevices: ["/dev/sda"],
  LVM: true
};

const storageActionsProxy = {
  wait: jest.fn(),
  All: [
    {
      Text: { t: "v", v: { t: "s", v: "Mount /dev/sdb1 as root" } },
      Subvol: { t: "v", v: { t: "b", v: false } },
      Delete: { t: "v", v: { t: "b", v: false } }
    }
  ]
};

const proxies = {
  [STORAGE_PROPOSAL_IFACE]: storageProposalProxy,
  [STORAGE_ACTIONS_IFACE]: storageActionsProxy
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    return proxies[iface];
  });
});

describe("#getStorageProposal", () => {
  it("returns the storage proposal settings", async () => {
    const client = new StorageClient(dbusClient);
    const proposal = await client.getStorageProposal();
    expect(proposal).toEqual({
      availableDevices: [
        { id: "/dev/sda", label: "/dev/sda, 950 GiB, Windows" },
        { id: "/dev/sdb", label: "/dev/sdb, 500 GiB" }
      ],
      candidateDevices: ["/dev/sda"],
      lvm: true
    });
  });
});

describe("#getStorageActions", () => {
  it("returns the storage actions", async () => {
    const client = new StorageClient(dbusClient);
    const actions = await client.getStorageActions();
    expect(actions).toEqual([{ text: "Mount /dev/sdb1 as root", subvol: false, delete: false }]);
  });
});

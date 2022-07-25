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

import React, { useState, useEffect, useCallback } from "react";
import { useSafeEffect } from "./utils";
import { useInstallerClient } from "./context/installer";

import { Progress, Stack, StackItem, Text } from "@patternfly/react-core";

const ProgressReport = () => {
  const client = useInstallerClient();
  // progress and subprogress are basically objects containing { message, step, steps }
  const [progress, setProgress] = useState({});
  const [subProgress, setSubProgress] = useState(undefined);

  useSafeEffect(useCallback((makeSafe) => {
    client.manager.getProgress().then(({ message, current, total }) => {
      makeSafe(setProgress)({ message, step: current, steps: total });
    });
  }, [client.manager]));

  useEffect(() => {
    return client.manager.onProgressChange(({ message, current, total }) => {
      setProgress({ message, step: current, steps: total });
    });
  }, [client.manager]);

  useEffect(() => {
    return client.software.onProgressChange(({ message, current, total, finished }) => {
      if (finished) {
        setSubProgress(undefined);
      } else {
        setSubProgress({ message, step: current, steps: total });
      }
    });
  }, [client.software]);

  if (!progress.steps) return <Text>Waiting for progress status...</Text>;

  return (
    <Stack hasGutter className="pf-u-w-100">
      <StackItem>
        <Progress
          min={0}
          max={progress.steps}
          value={progress.step}
          title={progress.message}
          label={" "}
          aria-label={progress.message}
        />
      </StackItem>

      <StackItem>
        <Progress
          size="sm"
          min={0}
          max={subProgress?.steps}
          value={subProgress?.step}
          title={subProgress?.message}
          label={" "}
          measureLocation="none"
          className={!subProgress && 'hidden'}
          aria-label={subProgress?.message || " "}
          aria-hidden={!subProgress}
        />
      </StackItem>
    </Stack>
  );
};

export default ProgressReport;

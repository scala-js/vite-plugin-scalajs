import { beforeEach, describe, expect, it, TestOptions } from 'vitest';
import scalaJSPlugin, { ScalaJSPluginOptions } from "../index";
import type { PluginContext } from 'rollup';
import type { Plugin as VitePlugin } from "vite";

/* This interface refines the VitePlugin with some knowledge about our
 * particular implementation, for easier testing. If we define here something
 * that is incompatible with what's in VitePlugin, the compiler complains, so
 * we do get some safety that we adhere to VitePlugin's API.
 */
interface RefinedPlugin extends VitePlugin {
  configResolved: (this: void, resolvedConfig: { mode: string }) => void | Promise<void>;
  buildStart: (this: PluginContext, options: {}) => void | Promise<void>;
  resolveId: (this: PluginContext, source: string) => string | Promise<string>;
}

function normalizeSlashes(path: string | null): string | null {
  return path === null ? null : path.replace(/\\/g, '/');
}

const MODE_DEVELOPMENT = 'development';
const MODE_PRODUCTION = 'production';

describe("scalaJSPlugin", () => {
  const cwd = process.cwd() + "/test/testproject";

  const testOptions: TestOptions = {
    timeout: 60000, // running sbt takes time
  };

  const setup: (options: ScalaJSPluginOptions) => [RefinedPlugin, PluginContext] = (options) => {
    const plugin = scalaJSPlugin({ cwd: cwd, ...options }) as RefinedPlugin;
    const fakePluginContext = {} as PluginContext;
    return [plugin, fakePluginContext];
  }

  /* Wait for 2 seconds between tests to let sbt close its server.
   * Without this, we get spurious failures with
   * > sbt thinks that server is already booting because of this exception:
   * > sbt.internal.ServerAlreadyBootingException: java.io.IOException:
   *   Could not create lock for \\.\pipe\sbt-load3101661995253037154_lock, error 5
   */
  beforeEach(() => {
    return new Promise(resolve => {
      setTimeout(resolve, 2000);
    });
  });

  it("works without a specific projectID (production)", async () => {
    const [plugin, fakePluginContext] = setup({});

    await plugin.configResolved.call(undefined, { mode: MODE_PRODUCTION });
    await plugin.buildStart.call(fakePluginContext, {});

    expect(normalizeSlashes(await plugin.resolveId.call(fakePluginContext, 'scalajs:main.js')))
      .toContain('/testproject/target/scala-3.3.3/testproject-opt/main.js');

    expect(await plugin.resolveId.call(fakePluginContext, 'scalajs/main.js'))
      .toBeNull();
  }, testOptions);

  it("works without a specific projectID (development)", async () => {
    const [plugin, fakePluginContext] = setup({});

    await plugin.configResolved.call(undefined, { mode: MODE_DEVELOPMENT });
    await plugin.buildStart.call(fakePluginContext, {});

    expect(normalizeSlashes(await plugin.resolveId.call(fakePluginContext, 'scalajs:main.js')))
      .toContain('/testproject/target/scala-3.3.3/testproject-fastopt/main.js');

    expect(await plugin.resolveId.call(fakePluginContext, 'scalajs/main.js'))
      .toBeNull();
  }, testOptions);

  it("works with a specific projectID (production)", async () => {
    const [plugin, fakePluginContext] = setup({
      projectID: "otherProject",
    });

    await plugin.configResolved.call(undefined, { mode: MODE_PRODUCTION });
    await plugin.buildStart.call(fakePluginContext, {});

    expect(normalizeSlashes(await plugin.resolveId.call(fakePluginContext, 'scalajs:main.js')))
      .toContain('/testproject/other-project/target/scala-3.3.3/otherproject-opt/main.js');

    expect(await plugin.resolveId.call(fakePluginContext, 'scalajs/main.js'))
      .toBeNull();
  }, testOptions);

  it("works with a custom URI prefix (development)", async () => {
    const [plugin, fakePluginContext] = setup({
      uriPrefix: "customsjs",
    });

    await plugin.configResolved.call(undefined, { mode: MODE_DEVELOPMENT });
    await plugin.buildStart.call(fakePluginContext, {});

    expect(normalizeSlashes(await plugin.resolveId.call(fakePluginContext, 'customsjs:main.js')))
      .toContain('/testproject/target/scala-3.3.3/testproject-fastopt/main.js');

    expect(await plugin.resolveId.call(fakePluginContext, 'scalajs:main.js'))
      .toBeNull();
  }, testOptions);

  it("does not work with a project that does not link", async () => {
    const [plugin, fakePluginContext] = setup({
      projectID: "invalidProject",
    });

    await plugin.configResolved.call(undefined, { mode: MODE_PRODUCTION });

    const buildStartResult = plugin.buildStart.call(fakePluginContext, {});
    expect(buildStartResult).rejects.toContain('sbt invocation');
  }, testOptions);
});

import { spawn, SpawnOptions } from "child_process";
import type { Plugin as VitePlugin } from "vite";

// Utility to invoke a given sbt task and fetch its output
function printSbtTask(task: string, cwd?: string): Promise<string> {
  const args = ["--batch", "-no-colors", "-Dsbt.supershell=false", `print ${task}`];
  const options: SpawnOptions = {
    cwd: cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
  };
  const child = process.platform === 'win32'
    ? spawn("sbt.bat", args.map(x => `"${x}"`), {shell: true, ...options})
    : spawn("sbt", args, options);

  let fullOutput: string = '';

  child.stdout!.setEncoding('utf-8');
  child.stdout!.on('data', data => {
    fullOutput += data;
    process.stdout.write(data); // tee on my own stdout
  });

  return new Promise((resolve, reject) => {
    child.on('error', err => {
      reject(new Error(`sbt invocation for Scala.js compilation could not start. Is it installed?\n${err}`));
    });
    child.on('close', code => {
      if (code !== 0) {
        let errorMessage = `sbt invocation for Scala.js compilation failed with exit code ${code}.`;
        if (fullOutput.includes("Not a valid command: --")) {
          errorMessage += "\nCause: Your sbt launcher script version is too old (<1.3.3)."
          errorMessage += "\nFix: Re-install the latest version of sbt launcher script from https://www.scala-sbt.org/"
        }
        reject(new Error(errorMessage));
      } else {
        resolve(fullOutput.trimEnd().split('\n').at(-1)!);
      }
    });
  });
}

export interface ScalaJSPluginOptions {
  cwd?: string,
  projectID?: string,
  uriPrefix?: string,
}

export default function scalaJSPlugin(options: ScalaJSPluginOptions = {}): VitePlugin {
  const { cwd, projectID, uriPrefix } = options;

  const fullURIPrefix = uriPrefix ? (uriPrefix + ':') : 'scalajs:';

  let isDev: boolean | undefined = undefined;

  let scalaJSOutputDirPromise: Promise<string> | undefined = undefined;

  function getScalaJSOutputDir() {
    if (scalaJSOutputDirPromise === undefined) {
      if (isDev === undefined) {
        throw new Error("configResolved must be called before attempting to resolve Scala.js output directory");
      }
      const task = isDev ? "fastLinkJSOutput" : "fullLinkJSOutput";
      const projectTask = projectID ? `${projectID}/${task}` : task;
      scalaJSOutputDirPromise = printSbtTask(projectTask, cwd);
    }
    return scalaJSOutputDirPromise;
  }

  return {
    name: "scalajs:sbt-scalajs-plugin",

    // Vite-specific
    configResolved(resolvedConfig) {
      isDev = resolvedConfig.mode === 'development';
    },

    // standard Rollup
    buildStart(options) {
      getScalaJSOutputDir();
    },

    // standard Rollup
    async resolveId(source, importer, options) {
      const scalaJSOutputDir = await getScalaJSOutputDir()

      if (!source.startsWith(fullURIPrefix))
        return null;
      const path = source.substring(fullURIPrefix.length);

      return `${scalaJSOutputDir}/${path}`;
    },
  };
}

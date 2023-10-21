import { spawn, SpawnOptions } from "child_process";
import type { Plugin as VitePlugin } from "vite";

// Utility to invoke a given sbt task and fetch its output
function printSbtTasks(tasks: Array<string>, cwd?: string): Promise<Array<string>> {
  const args = ["--batch", "-no-colors", "-Dsbt.supershell=false", ...tasks.map(task => `print ${task}`)];
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
      if (code !== 0)
        reject(new Error(`sbt invocation for Scala.js compilation failed with exit code ${code}.`));
      else
        resolve(fullOutput.trimEnd().split('\n').slice(-tasks.length));
    });
  });
}

export interface Subproject {
  projectID: string | null,
  uriPrefix: string,
}

export interface ScalaJSPluginOptions {
  cwd?: string,
  projectID?: string,
  uriPrefix?: string,
  subprojects?: Array<Subproject>,
}

function extractSubprojects(options: ScalaJSPluginOptions): Array<Subproject> {
  if (options.subprojects) {
    if (options.projectID || options.uriPrefix) {
      throw new Error("If you specify subprojects, you cannot specify projectID / uriPrefix")
    }
    return options.subprojects;
  } else {
    return [
      {
        projectID: options.projectID || null,
        uriPrefix: options.uriPrefix || 'scalajs',
      }
    ];
  }
}

function mapBy<T, K>(a: Array<T>, f: ((item: T) => K), itemName: string): Map<K, T> {
  const out = new Map<K, T>();
  a.forEach((item) => {
    const key: K = f(item);
    if (out.has(key)) {
      throw Error("Duplicate " + itemName + " " + key + ".");
    } else {
      out.set(key, item);
    }
  });
  return out;
}

function zip<T, U>(a: Array<T>, b: Array<U>): Array<[T, U]> {
  if (a.length != b.length) {
    throw new Error("length mismatch: " + a.length + " ~= " + b.length)
  }
  return a.map((item, i) => [item, b[i]]);
}

export default function scalaJSPlugin(options: ScalaJSPluginOptions = {}): VitePlugin {
  const { cwd } = options;
  const subprojects = extractSubprojects(options);
  // This also checks for duplicates
  const spByProjectID = mapBy(subprojects, (p) => p.projectID, "projectID")
  const spByUriPrefix = mapBy(subprojects, (p) => p.uriPrefix, "uriPrefix")

  let isDev: boolean | undefined = undefined;
  let scalaJSOutputDirs: Map<string, string> | undefined = undefined;

  return {
    name: "scalajs:sbt-scalajs-plugin",

    // Vite-specific
    configResolved(resolvedConfig) {
      isDev = resolvedConfig.mode === 'development';
    },

    // standard Rollup
    async buildStart(options) {
      if (isDev === undefined)
        throw new Error("configResolved must be called before buildStart");

      const task = isDev ? "fastLinkJSOutput" : "fullLinkJSOutput";
      const projectTasks = subprojects.map( p =>
        p.projectID ? `${p.projectID}/${task}` : task
      );
      const scalaJSOutputDirsArray = await printSbtTasks(projectTasks, cwd);
      scalaJSOutputDirs = new Map(zip(
        subprojects.map(p => p.uriPrefix),
        scalaJSOutputDirsArray
      ))
    },

    // standard Rollup
    resolveId(source, importer, options) {
      if (scalaJSOutputDirs === undefined)
        throw new Error("buildStart must be called before resolveId");
      const colonPos = source.indexOf(':');
      if (colonPos == -1) {
        return null;
      }
      const subprojectUriPrefix = source.substr(0, colonPos);
      const outDir = scalaJSOutputDirs.get(subprojectUriPrefix)
      if (outDir == null)
        return null;
      const path = source.substring(subprojectUriPrefix.length + 1);

      return `${outDir}/${path}`;
    },
  };
}

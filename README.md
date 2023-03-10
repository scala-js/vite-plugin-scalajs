# vite-plugin-scalajs

A [Vite](https://vitejs.dev/) plugin for [Scala.js](https://www.scala-js.org/).

## Usage

We assume that you have an existing Vite and Scala.js sbt project.
If not, [follow the accompanying tutorial](https://github.com/scala-js/scala-js-website/pull/590).

Install the plugin as a development dependency:

```shell
$ npm install -D @scala-js/vite-plugin-scalajs
```

Tell Vite to use the plugin in `vite.config.js`:

```javascript
import { defineConfig } from "vite";
import scalaJSPlugin from "@scala-js/vite-plugin-scalajs";

export default defineConfig({
  plugins: [scalaJSPlugin()],
});
```

Finally, import the Scala.js output from a `.js` or `.ts` file with

```javascript
import 'scalajs:main.js';
```

which will execute the main method of the Scala.js application.

The sbt project must at least be configured to use ES modules.
For the best feedback loop with Vite, we recommend to emit small modules for application code.
If your application lives in the `my.app` package, configure the sbt project with the following settings:

```scala
scalaJSLinkerConfig ~= {
  _.withModuleKind(ModuleKind.ESModule)
    .withModuleSplitStyle(
      ModuleSplitStyle.SmallModulesFor(List("my.app")))
},
```

## Configuration

The plugin supports the following configuration options:

```javascript
export default defineConfig({
  plugins: [
    scalaJSPlugin({
      // path to the directory containing the sbt build
      // default: '.'
      cwd: '.',

      // sbt project ID from within the sbt build to get fast/fullLinkJS from
      // default: the root project of the sbt build
      projectID: 'client',

      // URI prefix of imports that this plugin catches (without the trailing ':')
      // default: 'scalajs' (so the plugin recognizes URIs starting with 'scalajs:')
      uriPrefix: 'scalajs',
    }),
  ],
});
```

## Importing `@JSExportTopLevel` Scala.js members

`@JSExportTopLevel("foo")` members in the Scala.js code are exported from the modules that Scala.js generates.
They can be imported in `.js` and `.ts` files with the usual JavaScript `import` syntax.

For example, given the following Scala.js definition:

```scala
import scala.scalajs.js
import scala.scalajs.js.annotation._

@JSExportTopLevel("ScalaJSLib")
class ScalaJSLib extends js.Object {
  def square(x: Double): Double = x * x
}
```

we can import and use it as

```javascript
import { ScalaJSLib } from 'scalajs:main.js';

const lib = new ScalaJSLib();
console.log(lib.square(5)); // 25
```

### Exports in other modules

By default, `@JSExportTopLevel("Foo")` exports `Foo` from the `main` module, which is why we import from `scalajs:main.js`.
We can also split the Scala.js exports into several modules.
For example,

```scala
import scala.scalajs.js
import scala.scalajs.js.annotation._

@JSExportTopLevel("ScalaJSLib", "library")
class ScalaJSLib extends js.Object {
  def square(x: Double): Double = x * x
}
```

can be imported with

```javascript
import { ScalaJSLib } from 'scalajs:library.js';
```

The Scala.js documentation contains [more information about module splitting](https://www.scala-js.org/doc/project/module.html).

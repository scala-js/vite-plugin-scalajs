lazy val commonSettings = Def.settings(
  scalaVersion := "3.2.2",
  scalaJSUseMainModuleInitializer := true,
)

lazy val testproject = project.in(file("."))
  .enablePlugins(ScalaJSPlugin)
  .settings(commonSettings)

lazy val otherProject = project.in(file("other-project"))
  .enablePlugins(ScalaJSPlugin)
  .settings(commonSettings)

// This project does not link because it has no main method
lazy val invalidProject = project.in(file("invalid-project"))
  .enablePlugins(ScalaJSPlugin)
  .settings(commonSettings)

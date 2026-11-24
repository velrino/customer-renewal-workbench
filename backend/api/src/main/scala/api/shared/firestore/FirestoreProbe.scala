package api.shared.firestore

import com.google.cloud.firestore.FirestoreOptions
import java.util.concurrent.{Executors, TimeUnit, TimeoutException}
import scala.util.control.NonFatal

final class FirestoreProbe(project: Option[String], database: String):
  private val worker = Executors.newSingleThreadExecutor()
  private lazy val db = FirestoreOptions.newBuilder()
    .setProjectId(project.get)
    .setDatabaseId(database)
    .build().getService

  def check(): Option[String] =
    if project.forall(_.isBlank) then return Some("CHECK_NOT_CONFIGURED")
    // Include ADC discovery and client initialization in the caller's deadline.
    val task = worker.submit(() => {
      val read = db.document("_health/probe").get()
      try read.get(3, TimeUnit.SECONDS)
      finally if !read.isDone then read.cancel(true)
    })
    try
      task.get(3, TimeUnit.SECONDS)
      None
    catch
      case _: TimeoutException =>
        task.cancel(true)
        Some("TIMEOUT_EXCEEDED")
      case _: InterruptedException =>
        Thread.currentThread.interrupt()
        Some("UNAVAILABLE")
      case NonFatal(_) => Some("UNAVAILABLE")

  def close(): Unit = worker.shutdownNow()

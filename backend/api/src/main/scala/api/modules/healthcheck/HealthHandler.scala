package api.modules.healthcheck

import com.sun.net.httpserver.{HttpExchange, HttpHandler}
import java.nio.charset.StandardCharsets
import java.time.{Duration, Instant, ZoneOffset}
import java.time.temporal.ChronoUnit
import ujson.Obj

final class HealthHandler(environment: String, checkFirestore: () => Option[String]) extends HttpHandler:
  private val started = Instant.now()
  private val author = Obj(
    "name" -> "velrino", "github" -> "https://github.com/velrino/",
    "linkedin" -> "https://www.linkedin.com/in/velrino/", "instagram" -> "https://www.instagram.com/velrino",
    "website" -> "https://velrino.vercel.app/"
  )
  private case class Snapshot(error: Option[String], elapsed: Long, created: Instant, expires: Instant)
  private var cached: Option[Snapshot] = None

  private def snapshot(): (Snapshot, Boolean) = synchronized {
    cached.filter(_.expires.isAfter(Instant.now())) match
      case Some(value) => (value, true)
      case None =>
        val begin = System.nanoTime()
        val error = checkFirestore()
        val elapsed = (System.nanoTime() - begin) / 1000000
        val created = Instant.now()
        val value = Snapshot(error, elapsed, created, created.plusSeconds(if error.isEmpty then 60 else 5))
        cached = Some(value)
        (value, false)
  }

  private def uptime(now: Instant): Obj =
    val start = started.atOffset(ZoneOffset.UTC)
    val end = now.atOffset(ZoneOffset.UTC)
    val months = ChronoUnit.MONTHS.between(start, end)
    val rest = Duration.between(start.plusMonths(months), end)
    Obj("start" -> started.toString, "end" -> now.toString, "years" -> (months / 12).toDouble,
      "months" -> (months % 12).toDouble, "days" -> rest.toDays.toDouble, "hours" -> rest.toHoursPart,
      "minutes" -> rest.toMinutesPart, "seconds" -> rest.toSecondsPart)

  override def handle(exchange: HttpExchange): Unit =
    try
      if exchange.getRequestURI.getRawPath != "/" then exchange.sendResponseHeaders(404, -1)
      else if exchange.getRequestMethod != "GET" then
        exchange.getResponseHeaders.set("Allow", "GET")
        exchange.sendResponseHeaders(405, -1)
      else
        val begin = System.nanoTime()
        val (value, hit) = snapshot()
        val now = Instant.now()
        val healthy = value.error.isEmpty
        val check = Obj("status" -> (if healthy then "up" else "down"), "response_time" -> value.elapsed.toDouble)
        value.error.foreach(message => check("message") = message)
        val remaining = math.max(0L, Duration.between(now, value.expires).toNanos)
        val body = Obj(
          "name" -> "Customer Renewal Workbench API", "status" -> (if healthy then "ok" else "degraded"),
          "app_env" -> environment, "author" -> author,
          "runtime" -> Obj("last_deploy" -> started.toString, "uptime" -> uptime(now)),
          "checks" -> Obj("firestore" -> check),
          "cache" -> Obj("hit" -> hit, "created_at" -> value.created.toString,
            "expires_at" -> value.expires.toString, "seconds_remaining" -> ((remaining + 999999999L) / 1000000000L).toDouble),
          "result_time" -> Obj("total" -> ((System.nanoTime() - begin) / 1000000).toDouble, "average" -> value.elapsed.toDouble)
        ).render().getBytes(StandardCharsets.UTF_8)
        exchange.getResponseHeaders.set("Cache-Control", "no-store")
        exchange.getResponseHeaders.set("Content-Type", "application/json; charset=utf-8")
        exchange.sendResponseHeaders(if healthy then 200 else 503, body.length)
        exchange.getResponseBody.write(body)
    finally exchange.close()

package api

import api.modules.healthcheck.HealthHandler
import com.sun.net.httpserver.HttpServer
import java.net.{InetSocketAddress, URI}
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.*
import org.junit.Test

class HealthTest:
  private def verify(error: Option[String], status: Int, ttl: Int): Unit =
    val calls = new AtomicInteger()
    val server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 8)
    val pool = Executors.newFixedThreadPool(4)
    server.setExecutor(pool)
    server.createContext("/", new HealthHandler("test", () => { calls.incrementAndGet(); error }))
    server.start()
    try
      val base = URI.create(s"http://127.0.0.1:${server.getAddress.getPort}/")
      val client = HttpClient.newHttpClient()
      val request = HttpRequest.newBuilder(base).build()
      val body = HttpResponse.BodyHandlers.ofString()
      val pending = List.fill(4)(client.sendAsync(request, body))
      val results = pending.map(_.join()).map { response =>
        assertEquals(status, response.statusCode())
        assertEquals("no-store", response.headers.firstValue("Cache-Control").get())
        ujson.read(response.body())
      }
      assertEquals(1, calls.get())
      assertEquals(1, results.count(r => !r("cache")("hit").bool))
      val first = results.head
      assertEquals(if error.isEmpty then "ok" else "degraded", first("status").str)
      assertEquals(Set("firestore"), first("checks").obj.keySet.toSet)
      assertEquals(error, first("checks")("firestore").obj.get("message").map(_.str))
      assertTrue(first("result_time")("total").num >= 0)
      assertTrue(first("checks")("firestore")("response_time").num >= 0)
      assertTrue(first("cache")("seconds_remaining").num <= ttl)
      val cache = first("cache")
      assertEquals(Instant.parse(cache("created_at").str).plusSeconds(ttl), Instant.parse(cache("expires_at").str))
      assertEquals(404, client.send(HttpRequest.newBuilder(base.resolve("/missing")).build(), body).statusCode())
      assertEquals(405, client.send(HttpRequest.newBuilder(base).POST(HttpRequest.BodyPublishers.noBody()).build(), body).statusCode())
    finally
      server.stop(0)
      pool.shutdownNow()

  @Test def healthy(): Unit = verify(None, 200, 60)
  @Test def degraded(): Unit = verify(Some("UNAVAILABLE"), 503, 5)

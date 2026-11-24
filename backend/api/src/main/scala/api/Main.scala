package api

import api.modules.healthcheck.HealthHandler
import api.shared.firestore.FirestoreProbe
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.Executors

object Main:
  def main(args: Array[String]): Unit =
    val port = sys.env.getOrElse("PORT", "8080").toInt
    val server = HttpServer.create(new InetSocketAddress(port), 64)
    val workers = Executors.newFixedThreadPool(8)
    val probe = new FirestoreProbe(sys.env.get("GOOGLE_CLOUD_PROJECT"), sys.env.getOrElse("FIRESTORE_DATABASE", "default"))
    server.createContext("/", new HealthHandler(sys.env.getOrElse("APP_ENV", "local"), probe.check))
    server.setExecutor(workers)
    sys.addShutdownHook {
      server.stop(1)
      workers.shutdown()
      probe.close()
    }
    server.start()

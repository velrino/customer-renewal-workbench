FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN mvn -B -q package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/classes classes
COPY --from=build /build/target/dependency lib
USER 65532:65532
ENTRYPOINT ["java", "-cp", "classes:lib/*", "api.Main"]

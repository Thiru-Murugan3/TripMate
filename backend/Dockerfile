FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml ./
RUN mvn -B -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S tripmate && adduser -S tripmate -G tripmate
COPY --from=build /app/target/tripmate-backend-*.jar /app/tripmate.jar
RUN chown tripmate:tripmate /app/tripmate.jar

USER tripmate

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/tripmate.jar"]

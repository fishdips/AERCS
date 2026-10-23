# Build stage
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Copy just the wrapper + pom first so dependency downloads are cached
# separately from source changes.
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src ./src
RUN ./mvnw -B clean package -DskipTests

# Run stage — slim JRE-only image, no build tools
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/aercs-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

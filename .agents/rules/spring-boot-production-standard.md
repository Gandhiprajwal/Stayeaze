# Spring Boot Production Engineering Standard

## Core Review & Implementation Workflow
When reviewing or modifying any Java / Spring Boot application component:
1. Identify the current implementation.
2. Explain the production risk or problem.
3. Propose the recommended approach.
4. Estimate the impact and risk of the change.
5. Plan the implementation.
6. Implement the change incrementally with unit/integration test validation.
7. Do NOT introduce unnecessary technologies, microservices, or over-engineering.

---

## 1. Architecture & Code Structure
- **Strict Separation**: Controller → Service → Repository. Business logic must never reside in controllers or repositories.
- **DTO Encapsulation**: Never expose JPA entities directly through REST endpoints. Separate Request DTOs and Response DTOs.
- **Maintainable Mapping**: Use clean mapping (MapStruct or dedicated mapper methods) between entities and DTOs.
- **SOLID & Clean Code**: Avoid circular dependencies, duplicate business logic, or god-classes/methods.

## 2. Lombok & Entity Boilerplate
- Use explicit Lombok annotations (`@Getter`, `@Setter`, `@Builder`, `@RequiredArgsConstructor`, `@NoArgsConstructor`, `@AllArgsConstructor`).
- **Never blindly use `@Data` on JPA Entities**: Avoid broken `equals()`, `hashCode()`, or `toString()` recursion over lazy associations.
- Use Java `record`s for immutable DTOs and projection payloads.

## 3. REST API Design & Validation
- **Semantics**: Use proper HTTP verbs (GET, POST, PUT, PATCH, DELETE) and standardized HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 422, 500).
- **Bean Validation**: Enforce validation at API boundary using `@NotNull`, `@NotBlank`, `@Size`, `@Min`, `@Max`, `@Email`, `@Valid`, `@Validated`.
- **Global Exception Handling**: Centralize error handling with `@RestControllerAdvice`. Return uniform error payloads (`timestamp`, `status`, `errorCode`, `message`, `path`, `correlationId`). Never leak stack traces, database schemas, or secrets.

## 4. Database, JPA & Connection Pooling
- **Query Efficiency**: Prevent N+1 query problems using `JOIN FETCH`, `@EntityGraph`, or DTO projections. Avoid `SELECT *` or loading unbounded datasets into memory.
- **Indexing**: Ensure frequently filtered/joined columns have matching DB indexes without over-indexing.
- **HikariCP Sizing**: Size pools based on `Total DB Connections = instances × pool size`. Configure `maximumPoolSize`, `minimumIdle`, `connectionTimeout`, `idleTimeout`, and `maxLifetime`.
- **Transaction Boundaries**: Keep `@Transactional` methods short. Use `readOnly = true` for queries. Never execute slow external HTTP calls inside DB transactions.
- **Migrations**: Version control all database schema changes with Flyway or Liquibase.

## 5. Caching & Concurrency
- **Cache-Aside Pattern**: Cache only high-read, low-write data with explicit TTLs. Invalidate keys on DB write/update/delete.
- **Graceful Cache Failure**: Ensure Redis failure gracefully falls back to database queries without bringing down core CRUD workflows.
- **Concurrency Protection**: Use `@Version` optimistic locking for concurrent entity modifications, or pessimistic locking where strict ordering is required.

## 6. Async Processing, Thread Pools & Resilience
- **Offload Heavy Tasks**: Use async processing/queues for emails, PDF receipts, webhook notifications, and report exports.
- **Bounded Thread Pools**: Never create unbounded `Executors`. Size request, async, and scheduled pools deliberately.
- **External Calls**: Every external HTTP/API integration must configure connection timeouts, read timeouts, exponential backoff, and circuit breakers (Resilience4j).

## 7. Security, Logging & Observability
- **Zero Hardcoding**: Passwords, JWT secrets, API keys, and credentials must strictly come from environment variables or secrets managers.
- **Backend Authorization**: Always enforce role and ownership checks on the server; never rely solely on frontend guards.
- **Safe Structured Logging**: Use SLF4J / Logback with correlation IDs (`MDC`). Never log passwords, tokens, API keys, or sensitive personal data.
- **Observability**: Expose Spring Boot Actuator health, readiness, liveness, and Prometheus metrics.

## 8. Prioritization Matrix
- **P0**: Security vulnerabilities, data loss risks, critical reliability bugs.
- **P1**: Production correctness, query bottlenecks, scale/concurrency issues.
- **P2**: Maintainability, performance optimization, test coverage gaps.
- **P3**: Minor cleanups and documentation enhancements.

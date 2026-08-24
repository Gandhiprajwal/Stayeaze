You are a senior Java/Spring Boot production engineer.

Your task is to review the entire Spring Boot application and identify missing production-level practices. Do NOT blindly modify code. First analyze the existing architecture, dependencies, configuration, database access, APIs, caching, concurrency, security, testing, logging, and deployment setup.

For every missing or weak area:
1. Identify the current implementation.
2. Explain the production risk/problem.
3. Propose the recommended approach.
4. Estimate the impact/risk of the change.
5. Plan the implementation.
6. Only then implement the change.
7. Do not introduce unnecessary technologies or over-engineering.

==================================================
1. ARCHITECTURE & CODE STRUCTURE
==================================================

Verify:

- Clear Controller → Service → Repository separation.
- Business logic must not be placed inside controllers.
- Repository must not contain business logic.
- DTOs should be used instead of exposing JPA entities directly through APIs.
- Request DTOs and Response DTOs should be separated where appropriate.
- Mapping between Entity and DTO should be clean and maintainable.
- Proper package/module structure.
- Avoid circular dependencies.
- Avoid unnecessary abstraction.
- Follow SOLID principles where they provide real value.
- Identify duplicated business logic.
- Identify classes/methods that are excessively large or complex.

Do not refactor code only for stylistic reasons.

==================================================
2. LOMBOK / BOILERPLATE
==================================================

Check whether Lombok is already used.

Prefer appropriate annotations such as:

@Getter
@Setter
@Builder
@RequiredArgsConstructor
@NoArgsConstructor
@AllArgsConstructor

Do not blindly replace everything with @Data.

For JPA entities:
- Carefully evaluate equals()
- hashCode()
- toString()
- Lazy relationships

Do not use Lombok-generated methods if they can cause JPA relationship or performance problems.

For immutable DTOs, consider Java records where appropriate.

Do not introduce Lombok if the project intentionally avoids it without first evaluating the project's conventions.

==================================================
3. REST API DESIGN
==================================================

Verify:

- Correct HTTP methods.
- Correct HTTP status codes.
- Consistent response structure.
- Proper resource naming.
- Pagination for large collections.
- Filtering/sorting where appropriate.
- API versioning strategy if required.
- Idempotency for operations that require it.
- Avoid returning unnecessary fields.
- Avoid returning database entities directly.
- Validate request payloads.

Check:

GET
POST
PUT
PATCH
DELETE

for proper semantics.

==================================================
4. VALIDATION
==================================================

Use Bean Validation where appropriate:

@NotNull
@NotBlank
@NotEmpty
@Size
@Min
@Max
@Email
@Pattern

Use:

@Valid
@Validated

Validate input at the API boundary.

Do not rely only on database constraints for user input validation.

==================================================
5. GLOBAL EXCEPTION HANDLING
==================================================

Check for:

@RestControllerAdvice

Use centralized exception handling.

Avoid repeated try/catch blocks in controllers.

Create consistent error responses containing appropriate information such as:

- timestamp
- HTTP status
- error code
- message
- request/path
- correlation/request ID where appropriate

Never expose:

- stack traces
- database errors
- internal implementation details
- secrets

to API clients.

==================================================
6. DATABASE
==================================================

Analyze:

- Schema
- Queries
- Indexes
- Foreign keys
- Constraints
- Transactions
- Connection pool
- N+1 queries
- Lazy/eager loading
- Batch operations
- Pagination

Check for:

- SELECT *
- unnecessary queries
- N+1 problems
- missing indexes
- excessive joins
- fetching unnecessary columns
- loading huge datasets into memory

Verify that frequently queried columns have appropriate indexes.

Do not add indexes blindly.

Use EXPLAIN/query plans when necessary.

==================================================
7. HIKARICP / CONNECTION POOL
==================================================

Verify database connection pooling.

Spring Boot normally uses HikariCP.

Review:

- maximumPoolSize
- minimumIdle
- connectionTimeout
- idleTimeout
- maxLifetime

Do not arbitrarily increase the connection pool.

Determine suitable values based on:

- database capacity
- application instances
- expected concurrency
- query latency

Remember:

Total DB connections =
number of application instances × pool size

Do not allow application instances to overwhelm the database.

==================================================
8. TRANSACTIONS
==================================================

Review @Transactional usage.

Verify:

- Transaction boundaries are appropriate.
- Transactions cover complete business operations.
- Read-only transactions are used where beneficial.
- Rollback behavior is correct.
- Isolation level is appropriate where required.
- Avoid unnecessarily long transactions.
- Avoid external API calls inside database transactions unless absolutely necessary.

Check for self-invocation problems with Spring proxy-based transactions.

==================================================
9. REDIS / CACHING
==================================================

If Redis is used, determine:

- What data is cached?
- Why is it cached?
- TTL?
- Cache key strategy?
- Serialization?
- Maximum object size?
- Eviction policy?
- Cache invalidation strategy?

Prefer cache-aside unless another strategy is justified.

READ:

Request
 ↓
Redis
 ↓
HIT → return
 ↓
MISS
 ↓
DB
 ↓
Redis SET
 ↓
return

CREATE:

DB INSERT
 ↓
Usually allow subsequent GET to populate cache.

UPDATE:

DB UPDATE
 ↓
successful operation
 ↓
invalidate Redis key

DELETE:

DB DELETE
 ↓
successful operation
 ↓
invalidate Redis key

Do NOT allow DB and Redis to silently diverge.

Consider:

- TTL
- retry for invalidation
- event-driven invalidation for distributed systems
- monitoring cache hit/miss rate

If multiple application instances use Redis, ensure cache behavior works correctly across instances.

==================================================
10. REDIS FAILURE HANDLING
==================================================

Redis should not unnecessarily become a single point of failure for normal CRUD operations.

If Redis is unavailable:

Determine whether the application should:

- fallback to database
- fail the request
- degrade gracefully

For non-critical caching, prefer graceful degradation where appropriate.

Do not make the entire application unavailable simply because an optional cache is down.

==================================================
11. CONCURRENCY
==================================================

Review concurrent access to shared data.

Check for:

- race conditions
- duplicate updates
- lost updates
- thread safety
- synchronized blocks
- concurrent collections
- optimistic locking
- pessimistic locking

For JPA entities where concurrent updates matter, evaluate:

@Version

Do not introduce synchronization without understanding the concurrency model.

==================================================
12. THREAD POOLS
==================================================

Identify:

- HTTP request thread pool
- Async executor
- Scheduled executor
- Kafka consumer threads
- DB connection pool

Do not create unlimited threads.

Analyze:

request threads
      ↓
application work
      ↓
DB connection pool
      ↓
database

Ensure thread pools and DB pools are sized based on actual workload.

==================================================
13. ASYNC PROCESSING
==================================================

Identify operations that should not block HTTP requests.

Examples:

- email
- notifications
- reports
- heavy processing
- external integrations
- large file processing

Consider asynchronous processing or messaging where justified.

Do NOT make everything asynchronous.

==================================================
14. KAFKA / MESSAGING
==================================================

Only introduce Kafka if there is a real requirement.

Evaluate whether Kafka is needed for:

- asynchronous processing
- high throughput
- event streaming
- decoupling
- durable events
- multiple consumers
- event replay

If Kafka is already present, verify:

- producer configuration
- consumer configuration
- retry strategy
- dead-letter topic
- consumer group strategy
- offset management
- idempotent consumers
- duplicate message handling
- partition strategy

Consumers must be designed to tolerate duplicate messages.

==================================================
15. WEB SOCKET
==================================================

If WebSocket is used:

Check:

- non-blocking architecture
- connection management
- heartbeat/ping-pong
- timeout
- authentication
- authorization
- connection limits
- message size limits
- rate limiting
- backpressure
- reconnection behavior

For horizontal scaling:

Load Balancer
      ↓
WebSocket Server 1
WebSocket Server 2
WebSocket Server 3
      ↓
Redis Pub/Sub / messaging layer

Do not assume one WebSocket server can handle unlimited connections.

Capacity must be determined through load testing.

==================================================
16. SECURITY
==================================================

Review:

- Spring Security
- Authentication
- Authorization
- JWT/OAuth2 where appropriate
- Password hashing
- HTTPS
- CORS
- CSRF where applicable
- Input validation
- SQL injection protection
- Secrets management
- Rate limiting
- Security headers

Never hardcode:

- passwords
- API keys
- JWT secrets
- database credentials
- private keys

Do not log sensitive information.

==================================================
17. AUTHORIZATION
==================================================

Authentication answers:

"Who are you?"

Authorization answers:

"What are you allowed to do?"

Verify that sensitive endpoints enforce authorization.

Do not rely only on frontend restrictions.

==================================================
18. LOGGING
==================================================

Replace:

System.out.println()

with proper application logging.

Use appropriate levels:

ERROR
WARN
INFO
DEBUG

Avoid excessive logging.

Never log:

- passwords
- tokens
- API keys
- secrets
- sensitive personal data

Include useful identifiers such as:

- request ID
- correlation ID
- user ID where safe
- entity ID

==================================================
19. OBSERVABILITY
==================================================

Verify Spring Boot Actuator where appropriate.

Monitor:

- request count
- error rate
- latency
- P95
- P99
- JVM memory
- GC
- CPU
- thread count
- DB connection pool
- Redis
- Kafka
- cache hit/miss
- external API latency

Health checks should distinguish between:

- application health
- readiness
- liveness
- dependency health

==================================================
20. DISTRIBUTED TRACING
==================================================

If multiple services exist, evaluate distributed tracing.

Track:

Request
 ↓
Service A
 ↓
Service B
 ↓
Database/Kafka

Use correlation/trace IDs.

==================================================
21. EXTERNAL API CALLS
==================================================

For every external service call check:

- connection timeout
- read timeout
- retry
- exponential backoff
- circuit breaker
- rate limiting
- fallback
- connection pooling

Never allow an external API to hang indefinitely.

Do not blindly retry non-idempotent operations.

==================================================
22. API RATE LIMITING
==================================================

Identify endpoints vulnerable to:

- abuse
- brute force
- excessive traffic
- expensive operations

Consider rate limiting using Redis/API Gateway where appropriate.

==================================================
23. PAGINATION
==================================================

Never load unlimited records.

Bad:

repository.findAll()

for potentially large datasets.

Use pagination:

Pageable
Page<T>

Evaluate cursor/keyset pagination for very large datasets.

==================================================
24. PERFORMANCE
==================================================

Profile before optimizing.

Look for:

- slow DB queries
- unnecessary network calls
- excessive serialization
- large payloads
- repeated computation
- cache misses
- excessive object creation
- N+1 queries
- blocking operations

Do not optimize based only on assumptions.

==================================================
25. JVM
==================================================

Review:

- heap configuration
- garbage collection
- memory usage
- thread count
- container memory limits

Do not tune JVM flags blindly.

Use metrics and profiling data.

==================================================
26. CONFIGURATION
==================================================

Use externalized configuration.

Never hardcode production configuration.

Separate:

dev
test
staging
production

Use environment variables/secrets management for sensitive values.

==================================================
27. DATABASE MIGRATIONS
==================================================

Use a migration tool such as:

Flyway
or
Liquibase

Do not rely on manually modifying production databases.

Every schema change should be version controlled.

==================================================
28. TESTING
==================================================

Check:

Unit tests
Integration tests
Repository tests
Controller/API tests
Security tests
Contract tests where appropriate
Performance/load tests for critical paths

Consider Testcontainers for realistic integration testing.

Critical business logic should have strong automated test coverage.

==================================================
29. RESILIENCE
==================================================

For critical dependencies evaluate:

Timeout
Retry
Circuit Breaker
Bulkhead
Rate Limiting
Fallback

Avoid cascading failures.

==================================================
30. IDEMPOTENCY
==================================================

For operations where duplicate requests can cause problems, implement idempotency.

Examples:

Payment
Order creation
External API calls

Consider:

Idempotency-Key

and persistent deduplication where necessary.

==================================================
31. DOCKER / DEPLOYMENT
==================================================

If containerized:

- use small production images
- run as non-root
- configure health checks
- externalize configuration
- define resource limits
- handle graceful shutdown

==================================================
32. CI/CD
==================================================

Pipeline should ideally include:

Build
 ↓
Unit tests
 ↓
Integration tests
 ↓
Static analysis
 ↓
Security scan
 ↓
Docker build
 ↓
Deploy
 ↓
Smoke/health checks

==================================================
33. GRACEFUL SHUTDOWN
==================================================

Verify that the application handles shutdown properly.

On shutdown:

- stop accepting new requests
- finish active requests where possible
- close DB connections
- close Kafka consumers
- close WebSocket connections appropriately
- release resources

==================================================
34. FILE / LARGE DATA PROCESSING
==================================================

For large files or large datasets:

- avoid loading everything into memory
- use streaming
- validate file size/type
- apply timeouts
- use asynchronous processing when appropriate

==================================================
35. PRODUCTION CONFIGURATION
==================================================

Review:

- logging configuration
- database configuration
- connection pools
- Redis
- Kafka
- thread pools
- timeouts
- security
- actuator
- metrics
- CORS
- allowed origins
- resource limits

Do not use development configuration in production.

==================================================
36. CODE QUALITY
==================================================

Check:

- Sonar/static analysis
- Checkstyle if project uses it
- SpotBugs where appropriate
- dependency vulnerabilities
- unused dependencies
- outdated libraries

Do not upgrade dependencies blindly.

Check compatibility before upgrading.

==================================================
37. DEPENDENCY MANAGEMENT
==================================================

Review every dependency.

For each dependency determine:

- Why is it needed?
- Is it actually used?
- Is there a security vulnerability?
- Is there a lighter alternative?
- Is it compatible with current Spring Boot/Java version?

Avoid unnecessary dependencies.

==================================================
38. LOAD TESTING
==================================================

For important APIs determine expected:

- requests/sec
- concurrent users
- response latency
- P95
- P99
- CPU
- memory
- DB utilization

For WebSocket:

- concurrent connections
- messages/sec
- payload size
- connection duration
- reconnect rate

Do not claim an application can handle a specific load without testing.

==================================================
39. PRODUCTION READINESS REPORT
==================================================

After analysis, create a report with:

1. Current architecture
2. Critical issues
3. High-priority issues
4. Medium-priority improvements
5. Low-priority improvements
6. Performance bottlenecks
7. Security issues
8. Reliability issues
9. Database issues
10. Caching issues
11. Scalability issues
12. Observability gaps
13. Testing gaps
14. Deployment gaps

For every issue provide:

- Current state
- Problem
- Production impact
- Recommended solution
- Implementation plan
- Priority
- Dependencies
- Risk

==================================================
40. IMPLEMENTATION RULES
==================================================

IMPORTANT:

- Do not rewrite the entire application.
- Do not introduce Kafka, Redis, Kubernetes, microservices, etc. without a concrete requirement.
- Prefer the simplest production-safe solution.
- Preserve existing business behavior.
- Make one logical change at a time.
- Run tests after each significant change.
- Do not change public API behavior without justification.
- Do not remove existing functionality.
- Do not optimize without evidence where possible.
- Prefer measurable improvements.
- Flag architectural decisions that require human approval.

Priority:

P0 = Security/data-loss/critical reliability issue
P1 = Production correctness/performance/scalability issue
P2 = Important maintainability/optimization
P3 = Nice-to-have improvement

Before implementing P0/P1 architectural changes, explain the proposed solution and impact.
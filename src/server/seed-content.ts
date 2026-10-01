export const seedDocuments = [
  {
    title: "Product brief & growth constraints",
    kind: "markdown",
    content: `# Northstar · Product brief

Northstar is a B2B analytics SaaS serving 120 customer organizations. The product has 8,000 daily active users and currently handles 40 requests per second at peak. The growth plan targets 10x peak traffic within twelve months, reaching 400 requests per second. These are planning estimates, not benchmark results.

## Team and delivery
The engineering team consists of four full-stack engineers and one product designer. There is no dedicated platform team or SRE. The enterprise reporting launch is due in eight weeks. Operational complexity and on-call load must stay manageable.

## Reliability and budget
The target availability is 99.9%. Interactive API latency should remain below 250 ms at p95. Monthly infrastructure spend should remain under $2,000 at launch. Customer data must remain in one EU region. The product needs tenant isolation, audit logs, and point-in-time database recovery.`,
  },
  {
    title: "Proposal A · Modular monolith",
    kind: "markdown",
    content: `# Proposal A · Modular monolith

Deploy one TypeScript application with separate modules for identity, billing, ingestion, and reporting. Use PostgreSQL as the system of record. Start with two stateless application replicas behind a load balancer. Move expensive report generation to a background worker using a durable queue.

## Cost and operations
Estimated baseline monthly cost is $650 including managed PostgreSQL, two application replicas, object storage, and a small worker. This estimate excludes enterprise support and unusually high egress. One release pipeline and shared observability reduce the operational burden on four engineers.

## Scaling and trade-offs
Scale application replicas horizontally and index high-volume queries. Introduce read replicas only after measuring read pressure. Module boundaries should enforce data ownership so ingestion or reporting can be extracted later. A shared deployment couples releases and increases blast radius. Load tests are required before claiming support for 400 requests per second.`,
  },
  {
    title: "Proposal B · Event-driven services",
    kind: "markdown",
    content: `# Proposal B · Event-driven services

Split ingestion, reporting, identity, and billing into independently deployed services. Use Kafka for durable event streaming and Kubernetes for orchestration. Each service owns its database schema and publishes domain events.

## Cost and operations
Estimated baseline monthly cost is $1,850 before increased observability, support, and data-transfer costs. Independent deployments and workload-specific scaling can benefit larger teams. This proposal requires distributed tracing, schema evolution, consumer lag alerts, replay procedures, and on-call runbooks.

## Delivery risk
The migration estimate is 12–16 weeks. Eventual consistency affects billing and report freshness. Without a dedicated platform engineer, operating Kafka and Kubernetes will draw time from the eight-week product launch. Services isolate failures when retries, backpressure, and idempotency are implemented correctly.`,
  },
  {
    title: "Architecture review · Risk register",
    kind: "markdown",
    content: `# Architecture review · Risk register

The current bottleneck is synchronous report generation, not request routing. A large customer report can occupy an application worker for 30 seconds. Moving report generation behind a durable queue is the highest-priority experiment for either architecture.

## Evidence gaps
Neither proposal includes a representative load test. The 10x forecast is a planning target. Test 400 requests per second using realistic tenant distributions and report workloads before committing to capacity claims. Record p95 latency, database saturation, queue depth, and error rate.

## Decision gates
Prefer the modular monolith while the team is four engineers and the launch is eight weeks away. Revisit service extraction when independent teams own distinct domains, deployments are measurably blocked by coupling, or a workload needs independent scaling. Re-evaluate costs quarterly. Preserve tenant isolation, EU residency, and restore drills under either proposal.`,
  },
];
export { examplePrompt } from "../lib/demo";

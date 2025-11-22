# /implement Command

**USAGE**: `/implement [feature_description]`

**PURPOSE**: Execute systematic implementation workflow with adaptive tier selection, comprehensive validation, and proven agent coordination patterns.

## Description

The `/implement` command executes the full implementation lifecycle using specialized agents.

# 🚀 Implementation Workflow

## 🎯 Adaptive Tier Selection

### **📊 Automatic Complexity Detection**

```bash
# Implementation Complexity Analysis
"Analyze implementation task complexity for tier selection:

IMPLEMENTATION TASK:
- Feature/fix description: [describe what needs to be implemented]
- Files to be modified: [number and list]
- Services involved: [number and names]
- New components needed: [yes/no and details]
- Dependencies affected: [cross-service dependencies]
- Risk level: [low/medium/high]

TIER RECOMMENDATION:
- Tier 1 (Simple): ≤3 files, single service, no new components, low risk
- Tier 2 (Standard): 4-10 files, 2-3 services, minor new components, medium risk
- Tier 3 (Complex): >10 files, >3 services, major new components, high risk

OUTPUT:
RECOMMENDED TIER: [1/2/3]
WORKFLOW: [Simple/Standard/Complex Implementation]
ESTIMATED TIME: [duration]
PARALLEL OPPORTUNITIES: [yes/no with specific tasks]
RISK FACTORS: [list key risks]"
```

### **⚙️ Implementation Tier Override**

```bash
# Force Tier 1 (Simple Implementation)
"Override to Tier 1 Simple Implementation:
STEPS: Implement → Review (2 steps)
AGENTS: code-implementer → code-reviewer
DURATION: <30 minutes"

# Force Tier 2 (Standard Implementation)
"Override to Tier 2 Standard Implementation:
STEPS: Analyze → Implement → Review → Test (4 steps)
AGENTS: solution-architect → code-implementer → code-reviewer → test-specialist
DURATION: 30-120 minutes"

# Force Tier 3 (Complex Implementation)
"Override to Tier 3 Complex Implementation:
STEPS: Full 10-step workflow with comprehensive validation
AGENTS: All specialized agents with full review cycles
DURATION: >120 minutes"
```

## 📋 10-Step Enhanced Implementation Workflow

### **Step 1: Architecture Analysis (solution-architect agent)**
```bash
Task: solution-architect
Prompt: "Analyze the user request and current codebase to create comprehensive implementation plan. Assess: 1) What needs to be implemented, 2) Current system capabilities, 3) Implementation feasibility, 4) Parallel vs sequential task identification, 5) Risk assessment, 6) Resource requirements, 7) Success criteria"
```

### **Step 2: Plan Review (code-reviewer agent)**
```bash
Task: code-reviewer
Prompt: "Review the implementation plan for quality, feasibility, and risks. Analyze: 1) Plan completeness and accuracy, 2) Risk assessment validation, 3) Parallel execution safety, 4) Missing considerations, 5) Quality standards alignment"
```

### **Step 3: Implementation Execution (code-implementer agents)**
```bash
# Launch parallel code-implementer agents for independent tasks
Task: code-implementer (Agent 1)
Prompt: "Implement [Phase 1 tasks] - specific requirements and success criteria..."

Task: code-implementer (Agent 2)
Prompt: "Implement [Phase 2 tasks] - specific requirements and success criteria..."
```

**Key Principles:**
- **Run agents in parallel** only for independent tasks (different files/components)
- **Use sequential execution** for dependent tasks
- **Provide specific requirements** and success criteria for each agent

### **Step 4: Implementation Review (code-reviewer agent)**
```bash
Task: code-reviewer
Prompt: "Review the implemented code for quality, security, and adherence to requirements. Analyze: 1) Code quality and best practices, 2) Security vulnerabilities, 3) Performance considerations, 4) Error handling, 5) Type safety, 6) Requirements compliance"
```

### **Step 5: Security Assessment (security-auditor agent)**
```bash
Task: security-auditor
Prompt: "Conduct comprehensive security assessment of implemented code:

SECURITY ANALYSIS SCOPE:
1. Static Code Analysis (SQL injection, XSS, auth flaws)
2. Dependency Security (vulnerable libraries)
3. Infrastructure Security (configuration, access control)
4. Compliance Assessment (OWASP Top 10)

OUTPUT: Security report with vulnerability prioritization and remediation"
```

### **Step 6: Performance Optimization (performance-optimizer agent)**
```bash
Task: performance-optimizer
Prompt: "Analyze and optimize implementation performance:

PERFORMANCE ANALYSIS SCOPE:
1. Code Performance (algorithm efficiency, memory usage)
2. Database Performance (query optimization)
3. Caching Strategy (multi-level caching)
4. Load Testing (concurrent user simulation)

OUTPUT: Performance optimization report with recommendations"
```

### **Step 7: Critical Issues Resolution (code-implementer agents)**
```bash
Task: code-implementer
Prompt: "Fix the critical and high priority issues identified in security and performance assessments.

SECURITY FIXES: Resolve vulnerabilities
PERFORMANCE FIXES: Optimize bottlenecks
QUALITY FIXES: Improve error handling and type safety"
```

### **Step 8: Test Creation (test-specialist agent)**
```bash
Task: test-specialist
Prompt: "Create comprehensive test suite for the implemented features:

TEST COVERAGE REQUIREMENTS:
1. Unit Tests (core functionality, edge cases)
2. Integration Tests (component interaction, API testing)
3. Security Tests (auth, input validation)
4. Performance Tests (load testing, response times)
5. End-to-End Tests (critical user journeys)

OUTPUT: Comprehensive test suite with security and performance validation"
```

### **Step 9: Test Review & Improvement (code-reviewer → test-specialist cycle)**
```bash
Task: code-reviewer
Prompt: "Review the test implementation for quality, coverage, and effectiveness."

# If issues identified:
Task: test-specialist
Prompt: "Address the issues and improvements identified in the test review."
```

### **Step 10: Final Validation (test-runner agent)**
```bash
Task: test-runner
Prompt: "Execute comprehensive test validation of all implementations. Provide: 1) Full test suite execution results, 2) Pass rate statistics, 3) Remaining issues identification, 4) Success criteria verification"
```

## 🔄 Phase-Based Execution Pattern

### **Phase 1: Critical Fixes (Highest Priority)**
- Security vulnerabilities
- System-breaking issues
- Data integrity problems

### **Phase 2: Feature Implementation (High Priority)**
- Core functionality additions
- API enhancements
- User-facing features

### **Phase 3: Optimizations (Medium Priority)**
- Performance improvements
- Code refactoring
- Scalability enhancements

### **Phase 4: Polish & Documentation (Low Priority)**
- Code cleanup
- Documentation updates
- Test coverage improvements

## ⚡ Key Success Factors

### **✅ DO:**
- Use systematic approach with all steps
- Run parallel agents only for independent tasks
- Always review implementations before proceeding
- Fix critical issues immediately when identified
- Create comprehensive tests for new implementations
- Validate with test execution before completion

### **❌ DON'T:**
- Never skip the review steps
- Never run parallel agents on dependent tasks
- Don't proceed with critical issues unfixed
- Don't assume implementation works without validation

## 📊 Expected Results

**Quality Metrics:**
- **Implementation Grade**: B+ or higher from code-reviewer
- **Test Quality Grade**: A- or higher from test review
- **Test Coverage**: 90%+ for critical components
- **Validation Rate**: 85%+ test pass rate
- **Security Score**: No critical vulnerabilities

## 📋 Workflow Completion

```bash
"🎯 Implementation Workflow Complete!
- Implementation Grade: [A-F rating]
- Test Validation: [X]% pass rate
- Files Modified: [X] files across [Y] services
- Security Issues: [resolved count]

Next steps:
• /commit - Create clean atomic commits
• /status-report - Review all changes
• Continue with next task"
```

# /test-resolution Command

**USAGE**: `/test-resolution`

Execute systematic test failure resolution workflow with proven 95%+ success rate.

## 🎯 The Golden Rules

1. **Analyze before implementing** - 30 min analysis saves 3 hours debugging
2. **Test incrementally** - Test after each fix category, not at the end
3. **Fix by priority** - CRITICAL (blocks multiple tests) before LOW (nice-to-have)
4. **Fix CODE, not tests** - 90% of the time, the code is wrong, not the test
5. **Trust your types** - Type errors are usually root causes for cascading failures

---

## 🎯 Adaptive Tier Selection

### Tier 1 (Quick Fix)
- <20 failures
- Single category
- 1-2 files
- Duration: <30 minutes

### Tier 2 (Standard Resolution)
- 20-100 failures
- Mixed categories
- 3-10 files
- Duration: 30-120 minutes

### Tier 3 (Complex Resolution)
- >100 failures
- Multiple categories
- >10 files
- Duration: >120 minutes

---

## 📋 5-Phase Systematic Workflow

### **Phase 0: Pre-Flight Validation**
```bash
Task: test-runner
Prompt: "Pre-flight validation:
1. Verify Docker containers running
2. Check database connectivity
3. Run baseline test suite
4. Record current pass rate

REPORT: READY ✅ or BLOCKED ❌"
```

### **Phase 1: Strategic Analysis (solution-architect agent)**
```bash
Task: solution-architect
Prompt: "Analyze test failures:

1. Categorize all failures:
   - CRITICAL: Type errors, import failures (block multiple tests)
   - HIGH: Mock issues, assertion failures
   - MEDIUM: Edge cases, timing issues
   - LOW: Style, warnings

2. Identify root causes (not symptoms)
3. Create fix order (dependencies first)
4. Identify parallel opportunities

OUTPUT:
- Total failures: [X]
- Categories breakdown
- Recommended fix order
- Parallel vs sequential tasks"
```

### **Phase 2: Prioritized Implementation (code-implementer agents)**
```bash
# Phase 2a: CRITICAL fixes first
Task: code-implementer
Prompt: "Fix CRITICAL issues (type errors, import failures):
[specific issues list]

RULE: Fix the CODE, not the tests (90% rule)"

# Phase 2b: HIGH priority fixes
Task: code-implementer (parallel if safe)
Prompt: "Fix HIGH priority issues:
[specific issues list]"

# Phase 2c: MEDIUM/LOW fixes
Task: code-implementer
Prompt: "Fix remaining issues:
[specific issues list]"
```

**Key Principles:**
- Run parallel agents only for independent files
- Test after each priority level
- Rollback if regression detected

### **Phase 3: Incremental Validation (test-runner agent)**
```bash
# After each fix phase, validate
Task: test-runner
Prompt: "Run test suite and report:
1. Current pass rate
2. New failures (regressions)
3. Remaining failures
4. Comparison to baseline

IF regression detected:
- STOP and rollback last changes
- Re-analyze the failed fix"
```

### **Phase 4: Final Verification**
```bash
Task: test-runner
Prompt: "Final validation:
1. Run complete test suite
2. Verify no regressions
3. Report final statistics

SUCCESS CRITERIA:
- Pass rate ≥85% (configurable)
- No CRITICAL failures remaining
- No regressions from baseline"
```

### **Phase 5: Documentation & Cleanup**
```bash
Task: docs-sync-engineer
Prompt: "Document fixes:
1. Update test documentation
2. Note any known issues
3. Update coverage reports"
```

---

## ⚡ Anti-Pattern Detection

Before implementing, check for:

1. **Test Modification Anti-Pattern**
   - ❌ Changing test expectations to match buggy code
   - ✅ Fix the code, not the test

2. **Parallel Conflict Anti-Pattern**
   - ❌ Multiple agents modifying same files
   - ✅ Sequential execution for shared files

3. **Cleanup Order Anti-Pattern**
   - ❌ Parent entities deleted before children
   - ✅ Delete children first (foreign keys)

4. **Hardcoded Test Data Anti-Pattern**
   - ❌ Static IDs causing collisions
   - ✅ Use randomUUID() for unique IDs

---

## 🔄 Recovery Procedures

### On Regression
```bash
1. STOP further implementation
2. Identify regressing change
3. git stash or git checkout -- [files]
4. Re-analyze with different approach
5. Continue from last good state
```

### On Timeout
```bash
1. Check Docker container status
2. Restart if needed: docker compose restart
3. Re-run failed test in isolation
4. Increase timeout if legitimate slow test
```

---

## 📊 Success Metrics

**Target Pass Rates:**
- Minimum: 85%
- Good: 90%
- Excellent: 95%+

**Completion Criteria:**
- No CRITICAL failures remaining
- No regressions from baseline
- All HIGH priority issues resolved

---

## 📋 Workflow Completion

```bash
"🎯 Test Resolution Complete!
- Starting pass rate: [X]%
- Final pass rate: [Y]%
- Improvement: +[Z]%
- Tests fixed: [N]
- Remaining failures: [M]

Next steps:
• /commit - Commit the fixes
• /implement - Continue development
• Review remaining failures manually"
```

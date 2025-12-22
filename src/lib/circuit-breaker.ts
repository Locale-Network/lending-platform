/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures when external services (Plaid, Cartesi) are down.
 * After a threshold of failures, the circuit "opens" and fails fast instead of
 * waiting for timeouts.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, fail immediately
 * - HALF_OPEN: Testing if service is back up
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeoutMs: number; // Time to wait before trying again (half-open)
  name: string; // Name for logging
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  successesSinceHalfOpen: number;
}

// Store circuit states in memory
const circuits = new Map<string, CircuitBreakerState>();

function getOrCreateCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
      successesSinceHalfOpen: 0,
    });
  }
  return circuits.get(name)!;
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions
): Promise<T> {
  const circuit = getOrCreateCircuit(options.name);

  // Check if circuit should transition from OPEN to HALF_OPEN
  if (circuit.state === 'OPEN') {
    const timeSinceFailure = Date.now() - circuit.lastFailureTime;
    if (timeSinceFailure >= options.resetTimeoutMs) {
      circuit.state = 'HALF_OPEN';
      circuit.successesSinceHalfOpen = 0;
      console.log(`[CircuitBreaker] ${options.name}: Transitioning from OPEN to HALF_OPEN`);
    } else {
      const waitTime = Math.ceil((options.resetTimeoutMs - timeSinceFailure) / 1000);
      throw new CircuitBreakerError(
        `${options.name} is temporarily unavailable. Try again in ${waitTime}s`,
        options.name
      );
    }
  }

  try {
    const result = await fn();

    // Success - reset circuit
    if (circuit.state === 'HALF_OPEN') {
      circuit.successesSinceHalfOpen++;
      // After 2 successes in half-open, close the circuit
      if (circuit.successesSinceHalfOpen >= 2) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        console.log(`[CircuitBreaker] ${options.name}: Circuit CLOSED (service recovered)`);
      }
    } else {
      circuit.failures = 0;
    }

    return result;
  } catch (error) {
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    console.error(`[CircuitBreaker] ${options.name}: Failure ${circuit.failures}/${options.failureThreshold}`, error);

    // Check if we should open the circuit
    if (circuit.failures >= options.failureThreshold) {
      circuit.state = 'OPEN';
      console.log(`[CircuitBreaker] ${options.name}: Circuit OPENED (threshold reached)`);
    }

    throw error;
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerError extends Error {
  public readonly serviceName: string;
  public readonly isCircuitOpen = true;

  constructor(message: string, serviceName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.serviceName = serviceName;
  }
}

/**
 * Pre-configured circuit breakers for our services
 */
export const plaidCircuitBreaker = <T>(fn: () => Promise<T>) =>
  withCircuitBreaker(fn, {
    name: 'Plaid',
    failureThreshold: 3,
    resetTimeoutMs: 60000, // 1 minute
  });

export const cartesiCircuitBreaker = <T>(fn: () => Promise<T>) =>
  withCircuitBreaker(fn, {
    name: 'Cartesi',
    failureThreshold: 5,
    resetTimeoutMs: 30000, // 30 seconds
  });

/**
 * Get current circuit status (for health checks / debugging)
 */
export function getCircuitStatus(name: string): CircuitBreakerState | null {
  return circuits.get(name) || null;
}

/**
 * Manually reset a circuit (for admin use)
 */
export function resetCircuit(name: string): void {
  circuits.delete(name);
  console.log(`[CircuitBreaker] ${name}: Manually reset`);
}

/**
 * Retry with exponential backoff
 *
 * Use this for retrying individual operations that might transiently fail.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    name?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    name = 'operation',
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );

      console.log(
        `[Retry] ${name}: Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

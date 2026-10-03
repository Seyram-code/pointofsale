export class RequestTimeoutError extends Error {
  constructor(message = "The request timed out.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export function withRequestTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 8000,
  message = "The server took too long to respond.",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new RequestTimeoutError(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

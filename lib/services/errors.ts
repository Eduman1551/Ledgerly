/** An error with an HTTP status. Route handlers turn it into a JSON error response. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what: string) => new ServiceError(404, `${what} not found`);
export const badRequest = (message: string) => new ServiceError(400, message);
export const conflict = (message: string) => new ServiceError(409, message);
export const forbidden = (message: string) => new ServiceError(403, message);

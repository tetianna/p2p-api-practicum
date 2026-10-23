import Ajv, { type ErrorObject } from 'ajv';
import type { APIRequestContext } from '@playwright/test';

let ajvInstance: Ajv | null = null;
let loadPromise: Promise<Ajv> | null = null;

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) {
    return 'unknown validation error';
  }
  return errors
    .map((error) => {
      const path = error.instancePath.length > 0 ? error.instancePath : '/';
      return `${path}: ${error.message ?? 'invalid'}`;
    })
    .join('; ');
}

async function getAjv(request: APIRequestContext): Promise<Ajv> {
  if (ajvInstance) {
    return ajvInstance;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const response = await request.get('/openapi.json');
      if (!response.ok()) {
        throw new Error(
          `Failed to load OpenAPI document: GET /openapi.json returned ${response.status()}`,
        );
      }
      const doc: unknown = await response.json();
      const ajv = new Ajv({ strict: false, allErrors: true });
      ajv.addSchema(doc, 'openapi');
      ajvInstance = ajv;
      return ajv;
    })();
  }
  return loadPromise;
}

export async function expectSchema(
  request: APIRequestContext,
  body: unknown,
  name: string,
): Promise<void> {
  const ajv = await getAjv(request);
  const schemaId = `openapi#/components/schemas/${name}`;
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    throw new Error(`OpenAPI schema not found: ${schemaId}`);
  }
  const valid = validate(body);
  if (!valid) {
    throw new Error(
      `Schema "${name}" validation failed: ${formatAjvErrors(validate.errors)}`,
    );
  }
}

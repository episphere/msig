export const required = [
  'APP_BASE_URL',
  'APP_NAME',
  'APP_PORT',
  'APP_TIER',
  'LOG_LEVEL',
  'DATA_FOLDER',
  'INPUT_FOLDER',
  'OUTPUT_FOLDER',
  'DATA_BUCKET',
  'INPUT_KEY_PREFIX',
  'OUTPUT_KEY_PREFIX',
  'EMAIL_ADMIN',
  'EMAIL_SMTP_HOST',
  'EMAIL_SMTP_PORT',
  'VPC_ID',
  'SUBNET_IDS',
  'SECURITY_GROUP_IDS',
  'ECS_CLUSTER',
  'WORKER_TASK_NAME',
  'WORKER_TYPE',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASS',
  'POSTGRES_DB',
];

export function validateEnvironment(env = process.env, vars = required) {
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing environment variable: ${key}.`);
    }
  }
}

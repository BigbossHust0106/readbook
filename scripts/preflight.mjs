// Credential presence only. Never prints values, sends content, or creates resources.
const names = [
  "CLOUDFLARE_API_TOKEN",
  "SUPABASE_ACCESS_TOKEN",
  "LIBRETRANSLATE_URL",
];
let missing = false;
for (const name of names) {
  const present = Boolean(process.env[name]);
  console.log(
    `${name}: ${present ? "đã có binding (chưa xác minh quyền)" : "chưa có"}`,
  );
  if (!present) missing = true;
}
console.log(
  "Local reading does not require these credentials. Cloud creation and deployment require verified free-plan quotas and access.",
);
process.exitCode = missing ? 2 : 0;

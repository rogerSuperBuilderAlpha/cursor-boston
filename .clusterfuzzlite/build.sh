#!/usr/bin/env bash
# ClusterFuzzLite build script for the cursor-boston fuzz harness suite.
# Invoked by the ClusterFuzzLite base-builder image; environment variables
# OUT and SRC are provided by the base image.
set -euo pipefail

cd "$SRC/cursor-boston"

# Install only what the harnesses need. The full project's deps are
# heavy (Next.js, Firebase Admin, etc.) and ClusterFuzzLite's wall-clock
# budget is finite; the sanitize.fuzz.ts harness compiles standalone
# against jazzer.js.
npm install --no-audit --no-fund --no-save \
  @jazzer.js/core@2.1.0 \
  typescript@5.6.3

# Build each fuzz target as a self-contained Node.js script.
for target in fuzz/*.fuzz.ts; do
  name="$(basename "$target" .fuzz.ts)"
  out_dir="$OUT"
  out_name="fuzz_${name}"

  # Compile the harness + the slice of lib/ it imports into a single
  # CommonJS bundle so ClusterFuzzLite can invoke it without re-running
  # tsc at fuzz time.
  npx --no-install tsc \
    --module commonjs --target es2022 --esModuleInterop \
    --outDir "$out_dir/build_${name}" \
    --rootDir . \
    "$target" lib/sanitize.ts

  # ClusterFuzzLite expects an executable wrapper at $OUT/<target>.
  cat > "$out_dir/$out_name" <<'EOF'
#!/usr/bin/env node
const path = require("path");
const { startFuzzing } = require("@jazzer.js/core");

const targetFile = path.join(__dirname, "build_NAME/fuzz/NAME.fuzz.js");
startFuzzing({
  fuzzTarget: targetFile,
  fuzzFunction: "fuzz",
  sync: true,
  fuzzerOptions: process.argv.slice(2),
  timeout: 5000,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF
  sed -i "s/NAME/${name}/g" "$out_dir/$out_name"
  chmod +x "$out_dir/$out_name"
done

import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  devIndicators: false,
  reactCompiler: true,
  turbopack: { root: projectRoot },

  // The PRN route lives in a directory called `prn-module`, not `prn`, because
  // PRN is a reserved device name on Windows (alongside CON, AUX, NUL, COM1-9
  // and LPT1-9). Git refuses to index any path containing one — `git add` fails
  // with "No such file or directory" even though the file is plainly there — so
  // a repo holding `app/projects/prn/` cannot be cloned or checked out on
  // Windows at all. The rewrite keeps the URL everyone expects.
  async rewrites() {
    return [{ source: "/projects/prn", destination: "/projects/prn-module" }];
  },
};

export default nextConfig;

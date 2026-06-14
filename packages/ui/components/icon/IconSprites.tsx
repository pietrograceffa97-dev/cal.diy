import SVG from "react-inlinesvg";

// eslint-disable-next-line turbo/no-undeclared-env-vars
const vercelCommitHash = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
const commitHash = vercelCommitHash ? `-${vercelCommitHash.slice(0, 7)}` : "";

export function IconSprites() {
  // Load the sprite SAME-ORIGIN (relative path) rather than prefixing
  // NEXT_PUBLIC_WEBAPP_URL. On preview/staging deploys WEBAPP_URL points at a
  // different (or unreachable, e.g. localhost:3000) origin, so the absolute
  // sprite fetch fails and every icon renders blank. The sprite file ships in
  // the app's own /public/icons/sprite.svg, so a relative URL always resolves.
  return (
    <SVG src={`/icons/sprite.svg?v=${process.env.NEXT_PUBLIC_CALCOM_VERSION}-${commitHash}`} />
  );
}

export default IconSprites;

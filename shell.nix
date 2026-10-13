{ pkgs ? import <nixpkgs> {} }:

let
  playwrightBrowsers = pkgs.playwright-driver.passthru.browsers;
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_24
    coreutils
    git
    playwrightBrowsers
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-libav
  ];

  # WebKit's camera pipeline needs appsink and video conversion plugins.
  GST_PLUGIN_SYSTEM_PATH_1_0 = pkgs.lib.makeSearchPath "lib/gstreamer-1.0" (with pkgs.gst_all_1; [
    gst-plugins-base gst-plugins-good gst-plugins-bad gst-libav
  ]);

  PLAYWRIGHT_BROWSERS_PATH = "${playwrightBrowsers}";
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "ubuntu-24.04";

  shellHook = ''
    echo "flew-notes dev shell"
    echo "node $(node --version)"
    echo ""
    echo "available commands:"
    echo "  npm run dev       - start dev server"
    echo "  npm run build     - build for production"
    echo "  npm run test      - run playwright tests"
    echo "  npm run lint      - check formatting & lint"
    echo "  npm run format    - auto-format code"
    echo "  npm run check     - svelte type checking"
  '';
}

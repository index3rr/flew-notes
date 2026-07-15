{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_24
    coreutils
    git
  ];

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

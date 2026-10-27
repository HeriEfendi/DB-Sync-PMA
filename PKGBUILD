# Maintainer: Heri Efendi <heriefendi@gmail.com>
pkgname=db-sync-pma
pkgver=0.25.2
pkgrel=1
pkgdesc="DB Sync Engine PMA (PMA to Local MySQL)"
arch=('x86_64')
url="https://github.com/HeriEfendi/db-sync-pma"
license=('custom')
depends=('webkit2gtk-4.1' 'gtk3' 'cairo' 'hicolor-icon-theme' 'openssl')
makedepends=('nodejs' 'npm' 'cargo' 'rust')
provides=('db-sync-pma')
conflicts=('db-sync-pma')

build() {
  cd "$startdir"
  npm run build
  export CARGO_TARGET_DIR="$srcdir/target"
  cargo build --manifest-path src-tauri/Cargo.toml --release
}

package() {
  cd "$startdir"
  
  # Install binary
  install -Dm755 "$srcdir/target/release/db-sync-pma" "$pkgdir/usr/bin/db-sync-pma"
  
  # Install desktop application launcher
  install -d "$pkgdir/usr/share/applications"
  cat <<EOF > "$pkgdir/usr/share/applications/db-sync-pma.desktop"
[Desktop Entry]
Name=DB Sync Engine PMA
Comment=DB Sync Engine PMA (PMA to Local MySQL)
Exec=db-sync-pma
Icon=db-sync-pma
Terminal=false
Type=Application
Categories=Development;Database;Utility;
EOF

  # Install icons
  if [ -f "src-tauri/icons/128x128.png" ]; then
    install -Dm644 "src-tauri/icons/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/db-sync-pma.png"
  fi
  if [ -f "src-tauri/icons/32x32.png" ]; then
    install -Dm644 "src-tauri/icons/32x32.png" "$pkgdir/usr/share/icons/hicolor/32x32/apps/db-sync-pma.png"
  fi
}

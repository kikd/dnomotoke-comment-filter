"""Package already-built extensions. Uses Python standard library only."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile

root = Path(__file__).resolve().parents[1]
release = root / 'release'
release.mkdir(exist_ok=True)
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
results = []
for browser in ('chromium', 'firefox'):
    built = root / 'dist' / browser
    manifest = json.loads((built / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['version'] == version
    assert manifest['manifest_version'] == 3
    assert manifest['permissions'] == ['storage']
    if browser == 'firefox':
        settings = manifest['browser_specific_settings']
        assert settings['gecko']['strict_min_version'] == '140.0'
        assert settings['gecko_android']['strict_min_version'] == '142.0'
        assert settings['gecko']['data_collection_permissions']['required'] == ['none']
    files = {'manifest.json', 'LICENSE-webextension-polyfill.txt', 'options.css', manifest['options_ui']['page'], 'options.js'}
    files.update({'THIRD_PARTY_NOTICES.txt', 'licenses.html',
        'third-party/webextension-polyfill/browser-polyfill.js',
        'third-party/webextension-polyfill/browser-polyfill.js.map',
        'third-party/webextension-polyfill/package.json'})
    for name in ('background.js', 'content.js', 'options.js'):
        assert 'THIRD_PARTY_NOTICES.txt' in (built / name).read_text(encoding='utf-8')
    assert 'https://github.com/mozilla/webextension-polyfill/tree/0.12.0' in (built / 'THIRD_PARTY_NOTICES.txt').read_text()
    assert (built / 'third-party/webextension-polyfill/browser-polyfill.js').read_bytes() == (root / 'node_modules/webextension-polyfill/dist/browser-polyfill.js').read_bytes()
    for content in manifest['content_scripts']:
        files.update(content.get('js', []))
        files.update(content.get('css', []))
    background = manifest['background']
    files.update(background.get('scripts', []))
    if 'service_worker' in background:
        files.add(background['service_worker'])
    for size, name in manifest['icons'].items():
        png = (built / name).read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', png[16:24]) == (int(size), int(size))
        files.add(name)
    target = release / f'dnomotoke-comment-filter-{version}-{browser}.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(files):
            assert (built / name).is_file(), name
            archive.write(built / name, name)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == files
        assert 'manifest.json' in archive.namelist()
    results.append({'file': target.name, 'files': len(files), 'bytes': target.stat().st_size,
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})

# Source package for review/reproducible builds. No node_modules, local reports or browsing data.
source_files = []
for folder in ('src', 'styles', 'manifests', 'scripts', 'tests', 'assets/icons', 'store-assets'):
    source_files.extend(p for p in (root / folder).rglob('*') if p.is_file())
source_files.extend(root / name for name in ('package.json', 'package-lock.json', 'tsconfig.json',
    'vitest.config.ts', 'README.md', 'BUILDING.md', 'assets/comment-filter-icon-v2.png'))
target = release / f'dnomotoke-comment-filter-{version}-source.zip'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source_files):
        archive.write(path, path.relative_to(root).as_posix())
    for name in ('THIRD_PARTY_NOTICES.txt', 'LICENSE-webextension-polyfill.txt',
                 'third-party/webextension-polyfill/browser-polyfill.js',
                 'third-party/webextension-polyfill/browser-polyfill.js.map',
                 'third-party/webextension-polyfill/package.json'):
        archive.write(root / 'dist/chromium' / name, name)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    fixture = archive.read('tests/fixtures/saved-comment-tree.html').decode('utf-8')
    assert 'Independently authored synthetic fixture' in fixture
    assert '3366600' not in fixture and 'data-postid' not in fixture
results.append({'file': target.name, 'files': len(source_files) + 5, 'bytes': target.stat().st_size,
                'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
(release / 'checksums.sha256').write_text(''.join(f"{r['sha256']}  {r['file']}\n" for r in results), encoding='utf-8')
(release / 'package-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))

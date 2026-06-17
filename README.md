# JF - Pi Coding Agent

[![npm version](https://img.shields.io/npm/v/jf-pi-sdk?style=flat-square)](https://www.npmjs.com/package/jf-pi-sdk)
[![license](https://img.shields.io/github/license/cotapelu/jf?style=flat-square)](LICENSE)

JF là một coding agent mạnh mẽ, tích hợp các công cụ phát triển phần mềm AI‑ready. Xây dựng trên nền tảng Pi SDK.

## Tính năng chính

- Quản lý session và context compaction
- Indexer codebase với AST
- Skills engine và test generation
- Extensions framework (Git, …)
- Logging configurable

## Cài đặt

Cài đặt nhanh bằng npm (lệnh ngắn nhất):

<button onclick="navigator.clipboard.writeText('npm i -g github:cotapelu/jf');alert('Đã copy vào clipboard!')">📋 Copy lệnh</button>

```bash
npm i -g github:cotapelu/jf
```

Sau đó chạy:

```bash
jf --help
```

Hoặc cài với tag cụ thể (ví dụ v0.0.7):

<button onclick="navigator.clipboard.writeText('npm i -g github:cotapelu/jf#v0.0.7');alert('Đã copy vào clipboard!')">📋 Copy lệnh (v0.0.7)</button>

```bash
npm i -g github:cotapelu/jf#v0.0.7
```

## Cách dùng cơ bản

```bash
# Khởi động agent
jf

# Sử dụng các lệnh session
jf session create "Tên session"
jf session list
jf session switch <id>
```

## Phát triển

```bash
git clone https://github.com/cotapelu/jf.git
cd jf
npm install
npm run build
npm test
```

## License

Apache License 2.0 - xem file [LICENSE](LICENSE).

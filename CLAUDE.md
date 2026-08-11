# CLAUDE.md

Instruksi lengkap untuk AI coding agent ada di **[AGENTS.md](./AGENTS.md)**.

Baca file itu lebih dulu, lalu ikuti urutan baca dokumen di [`docs/00-INDEX.md`](./docs/00-INDEX.md).

Seluruh aturan wajib terkonsolidasi di **[`docs/RULES.md`](./docs/RULES.md)**.

Tiga hal yang paling sering salah — jangan sampai terjadi:

1. Jangan generate ulang SDP answer saat `accept`; ambil dari cache Redis (`R-006`).
2. Jangan aktifkan mikrofon sebelum menerima `call.accepted` (`R-120`).
3. Jangan query data domain tanpa scope `organization_id` (`R-061`).

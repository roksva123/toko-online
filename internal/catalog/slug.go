package catalog

import "strings"

// slugify mengubah teks menjadi slug URL: huruf kecil, angka, dan tanda hubung.
// Contoh: "Makanan & Minuman" -> "makanan-minuman".
func slugify(s string) string {
	var b strings.Builder
	lastDash := true // supaya tidak diawali tanda hubung
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		return "item"
	}
	return slug
}

// escapeLike meng-escape karakter khusus agar input pencarian dibaca apa adanya.
func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(s)
}
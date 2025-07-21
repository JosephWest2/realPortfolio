package index

import (
	"net/http"

	"josephwest2.com/portfolio/pages"
)

func Get(w http.ResponseWriter, r *http.Request) {
	pages.Render(index(), w)
}

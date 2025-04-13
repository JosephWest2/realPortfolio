package pages

import (
	"context"
	"net/http"
	"github.com/a-h/templ"
)

func Render(page templ.Component, w http.ResponseWriter) {
	p := layout(page)
	p.Render(context.Background(), w)
}

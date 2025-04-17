package main

import (
	"josephwest2.com/portfolio/pages/index"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	mux.HandleFunc("GET /", index.Get)
	http.ListenAndServe(":3000", mux)
}

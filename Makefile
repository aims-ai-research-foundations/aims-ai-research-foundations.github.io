# AI Research Foundations for Higher Education — common tasks
.PHONY: run build clean

# Start the local dev server at http://localhost:1313
# (live reload + no-cache headers in dev, so changes always show on refresh)
run:
	hugo server

# Build the production static site into ./public
build:
	hugo --gc --minify

# Remove generated output
clean:
	rm -rf public resources/_gen .hugo_build.lock

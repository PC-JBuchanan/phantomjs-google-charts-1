Usage
-----

1. Install [PhantomJS](http://phantomjs.org/download.html).
2. Most basic test (from console): 
    - Run the following command from examples/basic:
        phantomjs render.js
    - Open `chart.pdf` to see the result.
3. More advanced test (from console):
    - Run the following command:
        phantomjs google-convert.js -infile examples/json/example.json -outfile example.png -scale 2.5
    - Open `example.png` and see the result.
4. Use PHP to POST chart config to and return an image
    - Set up a chart on your webpage using the ChartWrapper (instead of writing a specific chart). 
        see https://developers.google.com/chart/interactive/docs/reference#chartwrapperobject for details. 
    - POST to your webserver (where you store the files from this project):
        json: JSONified configuration (JSONified: chartType, data, options, width, height); anything that goes into the ChartWrapper.
        filename: a filename (without extension) 
        type: image/svg+xml, image/png, image/jpeg, application/pdf
        chartsource: "google" (needed for interoperability with highcharts; charts from highcharts will not expose as chartsource.
    - this is fully compatible with https://github.com/highslide-software/highcharts.com/tree/master/exporting-server/phantomjs
        you can take the files from that location and store them alongside with this project, so that you can render highcharts and googlevisualizations together.

Todo
-----

1. Adapt index.php so that it uses phantomjs only to convert to SVG (if input is not SVG already). Then use BATIK to convert SVG to whatever. is supposed to be better.
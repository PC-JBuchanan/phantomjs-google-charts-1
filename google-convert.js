/**
 * @license Highcharts JS v3.0.1 (2012-11-02)
 *
 * (c) 20013-2014
 *
 * Author: Jeroen Baas
 * Based on: https://github.com/highslide-software/highcharts.com/blob/master/exporting-server/phantomjs/highcharts-convert.js
 * Original HighCharts-convert.js: 
 *     Author: Gert Vaartjes
 *     License: www.highcharts.com/license
 *     version: 2.0.1
 */

/*jslint white: true */
/*global window, require, phantom, console, $, document, Image, Highcharts, clearTimeout, clearInterval, options, cb */


(function () {
	"use strict";

	var config = {
			/* define locations of mandatory javascript files */
			JQUERY: 'jquery.1.9.1.min.js',
			TIMEOUT: 8000 /* 8 seconds timout for loading the chart. google may need time for plotting locations (marker map) */
		},
		mapCLArguments,
		render,
		startServer = false,
		args,
		pick,
		SVG_DOCTYPE = '<?xml version=\"1.0" standalone=\"no\"?><!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">',
		dpiCorrection = 1.4,
		system = require('system'),
		fs = require('fs');

	pick = function () {
		var args = arguments, i, arg, length = args.length;
		for (i = 0; i < length; i += 1) {
			arg = args[i];
			if (arg !== undefined && arg !== null && arg !== 'null' && arg != '0') {
				return arg;
			}
		}
	};

	mapCLArguments = function () {
		var map = {},
			i,
			key;

		if (system.args.length < 1) {
			console.log('Commandline Usage: google-convert.js -infile URL -outfile filename -scale 2.5 -width 300 -constr Chart -callback callback.js');
			console.log(', or run PhantomJS as server: google-convert.js -host 127.0.0.1 -port 1234');
		}

		for (i = 0; i < system.args.length; i += 1) {
			if (system.args[i].charAt(0) === '-') {
				key = system.args[i].substr(1, i.length);
				if (key === 'infile' || key === 'callback' || key === 'dataoptions' || key === 'globaloptions' || key === 'customcode') {
					// get string from file
					try {
						map[key] = fs.read(system.args[i + 1]);
					} catch (e) {
						console.log('Error: cannot find file, ' + system.args[i + 1]);
						phantom.exit();
					}
				} else {
					map[key] = system.args[i + 1];
				}
			}
		}
		return map;
	};

	render = function (params, runsAsServer, exitCallback) {

		var page = require('webpage').create(),
			messages = {},
			scaleAndClipPage,
			loadChart,
			input,
			constr,
			callback,
			width,
			output,
			outputExtension,
			svgInput,
			svg,
			svgFile,
			timer,
			renderSVG,
			convert,
			exit,
			interval;

		messages.imagesLoaded = 'Highcharts.images.loaded';
		messages.optionsParsed = 'Highcharts.options.parsed';
		messages.callbackParsed = 'Highcharts.cb.parsed';
		messages.ischartready='Google.chart.ready';
		window.imagesLoaded = true;//false;
		window.optionsParsed = false;
		window.callbackParsed = false;
		window.ischartready=false;

		page.onConsoleMessage = function (msg) {
			//console.log(msg);

			/*
			 * Ugly hack, but only way to get messages out of the 'page.evaluate()'
			 * sandbox. If any, please contribute with improvements on this!
			 */

			if (msg === messages.ischartready) {
				window.ischartready = true;
			}			 
			if (msg === messages.imagesLoaded) {
				window.imagesLoaded = true;
			}
			/* more ugly hacks, to check options or callback are properly parsed */
			if (msg === messages.optionsParsed) {
				window.optionsParsed = true;
			}

			if (msg === messages.callbackParsed) {
				window.callbackParsed = true;
			}
		};

		page.onAlert = function (msg) {
			console.log(msg);
		};

		/* scale and clip the page */
		scaleAndClipPage = function (svg) {
			/*	param: svg: The scg configuration object
			*/

			var zoom = 1,
				pageWidth = pick(params.width, svg.width),
				clipwidth,
				clipheight;

			if (parseInt(pageWidth, 10) == pageWidth) {
				zoom = pageWidth / svg.width;
			}

			/* set this line when scale factor has a higher precedence
			scale has precedence : page.zoomFactor = params.scale  ? zoom * params.scale : zoom;*/

			/* params.width has a higher precedence over scaling, to not break backover compatibility */
			page.zoomFactor = params.scale && params.width == undefined ? zoom * params.scale : zoom;

			clipwidth = svg.width * page.zoomFactor;
			clipheight = svg.height * page.zoomFactor;

			/* define the clip-rectangle */
			/* ignored for PDF, see https://github.com/ariya/phantomjs/issues/10465 */
			page.clipRect = {
				top: 0,
				left: 0,
				width: clipwidth,
				height: clipheight
			};

			/* for pdf we need a bit more paperspace in some cases for example (w:600,h:400), I don't know why.*/
			if (outputExtension === 'pdf') {
				// changed to a multiplication with 1.333 to correct systems dpi setting
				clipwidth = clipwidth * dpiCorrection;
				clipheight = clipheight * dpiCorrection;
				// redefine the viewport
				page.viewportSize = { width: clipwidth, height: clipheight};
				// make the paper a bit larger than the viewport
				page.paperSize = { width: clipwidth + 2 , height: clipheight + 2 };
			}
		};

		exit = function (result) {
			if (runsAsServer) {
				//Calling page.close(), may stop the increasing heap allocation
				page.close();
			}
			exitCallback(result);
		};

		convert = function (svg) {
			var base64;
			scaleAndClipPage(svg);
			if (outputExtension === 'pdf' || !runsAsServer) {
				page.render(output);
				exit(output);
			} else {
				base64 = page.renderBase64(outputExtension);
				exit(base64);
			}
		};

		renderSVG = function (svg) {
			// From this point we have loaded/or created a SVG
			try {
				if (outputExtension.toLowerCase() === 'svg') {
					// output svg
					svg = svg.html.replace(/<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace(/ href=/g, ' xlink:href=').replace(/<\/svg>.*?$/, '</svg>');
					// add xml doc type
					svg = SVG_DOCTYPE + svg;

					if (!runsAsServer) {
						// write the file
						svgFile = fs.open(output, "w");
						svgFile.write(svg);
						svgFile.close();
						exit(output);
					} else {
						// return the svg as a string
						exit(svg);
					}

				} else {
					// output binary images or pdf
					if (!window.ischartready) {
						// render with interval, waiting for all images loaded
						interval = window.setInterval(function () {
							console.log('waiting');
							if (window.ischartready) {
								clearTimeout(timer);
								clearInterval(interval);
								convert(svg);
							}
						}, 50);

						// we have a 3 second timeframe..
						timer = window.setTimeout(function () {
							clearInterval(interval);
							exitCallback('ERROR: While rendering, there\'s is a timeout reached');
						}, config.TIMEOUT);
					} else {
						// images are loaded, render rightaway
						convert(svg);
					}
				}
			} catch (e) {
				console.log('ERROR: While rendering, ' + e);
			}
		};

		loadChart = function (input, outputFormat, messages) {
			var nodeIter, nodes, elem, opacity, counter, svgElem;

			document.body.style.margin = '0px';
			document.body.innerHTML = input;

			function loadingImage() {
				console.log('Loading image ' + counter);
				counter -= 1;
				if (counter < 1) {
					console.log(messages.imagesLoaded);
				}
			}

			function loadImages() {
				var images = document.getElementsByTagName('image'), i, img;

				if (images.length > 0) {

					counter = images.length;

					for (i = 0; i < images.length; i += 1) {
						img = new Image();
						img.onload = loadingImage;
						/* force loading of images by setting the src attr.*/
						img.src = images[i].href.baseVal;
					}
				} else {
					// no images set property to:imagesLoaded = true
					console.log(messages.imagesLoaded);
				}
			}

			if (outputFormat === 'jpeg') {
				document.body.style.backgroundColor = 'white';
			}


			nodes = document.querySelectorAll('*[stroke-opacity]');

			for (nodeIter = 0; nodeIter < nodes.length; nodeIter += 1) {
				elem = nodes[nodeIter];
				opacity = elem.getAttribute('stroke-opacity');
				elem.removeAttribute('stroke-opacity');
				elem.setAttribute('opacity', opacity);
			}

			// ensure all image are loaded
			loadImages();

			svgElem = document.getElementsByTagName('svg')[0];

			return {
			    html: document.body.innerHTML,
			    width: svgElem.getAttribute("width"),
			    height: svgElem.getAttribute("height")
			};
		};

		if (params.length < 1) {
			// TODO: log when using as server
			exit("Error: Insuficient parameters");
		} else {
			input = params.infile;
			output = pick(params.outfile, "chart.png");
			constr = pick(params.constr, 'Chart');
			callback = params.callback;
			width = params.width;

			if (input === undefined || input.length === 0) {
				exit('Error: Insuficient or wrong parameters for rendering');
			}

			outputExtension = output.split('.').pop();

			/* Decide if we have to generate a svg first before rendering */
			svgInput = input.substring(0, 4).toLowerCase() === "<svg" ? true : false;

			page.open('gpage.html', function (status) {
				var svg,
					globalOptions = params.globaloptions,
					dataOptions = params.dataoptions,
					customCode = 'function customCode(options) {\n' + params.customcode + '}\n';


				if (svgInput) {
					//render page directly from svg file
					svg = page.evaluate(loadChart, input, outputExtension, messages);
					page.viewportSize = { width: svg.width, height: svg.height };
					renderSVG(svg);
				} else {
					// We have a js file, let highcharts create the chart first and grab the svg

					// load necessary libraries
					page.injectJs(config.JQUERY);
					page.evaluate(function(input) {
						// dynamic script insertion
						function loadScript(varStr, codeStr) {
							var $script = $('<script>').attr('type', 'text/javascript');
							$script.html('var ' + varStr + ' = ' + codeStr);
							document.getElementsByTagName("head")[0].appendChild($script[0]);
							if (window[varStr] !== undefined) {
								console.log('Google.' + varStr + '.parsed');
							}
						}	
						function chartready() {
							console.log('Google.chart.ready');
						}						
						loadScript('settings',input);
						if (settings.width) {
							$('#chart_div').width(settings.width);
						} else {
							$('#chart_div').width(400);
						}
						if (settings.height) {
							$('#chart_div').height(settings.width);
						} else {
							$('#chart_div').height(400);
						}
						settings.containerId='chart_div';
						var chart = new google.visualization.ChartWrapper(settings);	
						chart.draw();
						google.visualization.events.addListener(chart, 'ready', chartready);
					},args.infile);
					var svg=page.evaluate(function() {
						return {
							html: $('#chart_div svg').parent().html(),
							width: $('#chart_div').width(),
							height: $('#chart_div').height(),//chart.chartHeight
						};	
					});
					renderSVG(svg);
				}
			});
		}
	};

	startServer = function (host, port) {
		var server = require('webserver').create(),
			service = server.listen(host + ':' + port,
				function (request, response) {
					var jsonStr = request.post,
						params,
						msg;
					try {
						params = JSON.parse(jsonStr);
						if (params.status) {
							// for server health validation
							response.statusCode = 200;
							response.write('OK');
							response.close();
						} else {
							render(params, true, function (result) {
								// TODO: set response headers?
								response.statusCode = 200;
								response.write(result);
								response.close();
							});
						}
					} catch (e) {
						msg = "Failed rendering: \n" + e;
						response.statusCode = 500;
						response.setHeader('Content-Type', 'text/plain');
						response.setHeader('Content-Length', msg.length);
						response.write(msg);
						response.close();
					}
				});

		console.log("OK, PhantomJS is ready.");
	};

	args = mapCLArguments();

	if (args.port !== undefined) {
		startServer(args.host, args.port);
	} else {
		// presume commandline usage
		render(args, false, function (msg) {
			console.log(msg);
			phantom.exit();
		});
	}
}());

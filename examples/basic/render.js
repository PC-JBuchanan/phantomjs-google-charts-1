var page = require('webpage').create();
page.open('chart.html', function() {
    page.paperSize = { format: 'A4', orientation: 'landscape', border: '1cm' };
    page.render('chart.pdf');
    phantom.exit();
});

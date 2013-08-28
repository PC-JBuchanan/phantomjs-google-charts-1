<?php

ini_set('magic_quotes_gpc', 'off');

$type = $_POST['type'];
$json = (string) $_POST['json'];
$filename = (string) $_POST['filename'];

// prepare variables
if (!$filename) $filename = 'chart';
if (get_magic_quotes_gpc()) {
	$svg = stripslashes($svg);	
}


if ((!$_POST['json'])&&(!$_POST['svg'])) {
	die('We expect posted json code or SVG object');
}

$tmp_in_name = tempnam("/tmp", "HC");
if (isset($_POST['json'])) {
	$tmp_in_name_json=$tmp_in_name.".json";
	file_put_contents($tmp_in_name, $_POST['json']);
} else {
	$tmp_in_name_json=$tmp_in_name.".svg";
	file_put_contents($tmp_in_name, $_POST['svg']);

}
// allow no other than predefined types
if ($type == 'image/png') {
	$ext = 'png';
} elseif ($type == 'image/jpeg') {
	$ext = 'jpg';
} elseif ($type == 'application/pdf') {
	$ext = 'pdf';
} elseif ($type == 'image/svg+xml') {
	$ext = 'svg';	
} else {
	die('unknown type');
}
$tmp_out_name = $tmp_in_name.".".$ext;

if ($_POST['chartsource']=='google') {
	$chartsource='google';
} else {
	$chartsource='highcharts';
}

$output = shell_exec("/tool/phantomjs-1.9.1-linux-i686/bin/phantomjs $chartsource-convert.js -infile $tmp_in_name -outfile $tmp_out_name -scale 3");

// catch error
if (!is_file($tmp_out_name) || filesize($tmp_out_name) < 10) {
	echo "<pre>$output</pre>";
	echo "Error while converting input";		
} 

// stream it
else {
	header("Content-Disposition: attachment; filename=$filename.$ext");
	header("Content-Type: $type");
	echo file_get_contents($tmp_out_name);
}	


unlink($tmp_in_name);
unlink($tmp_in_name_json);
unlink($tmp_out_name);

?>
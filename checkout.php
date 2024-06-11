<?php
$x=$_POST['firstname'];
$a=$_POST['email'];
$y=$_POST['address'];
$z=$_POST['city'];
$b=$_POST['state'];
$c=$_POST['zip'];
$d=$_POST['cardname'];
$e=$_POST['cardnumber'];
$f=$_POST['expmonth'];
$g=$_POST['expyear'];
$h=$_POST['cvv'];
$i=$_POST['sameadr'];


$servername = "localhost";
$username = "root";
$password =  "";
$dbname="db1";

$conn = new mysqli($servername, $username, $password, $dbname);


if ($conn->connect_error) {

    die("Connection failed: " . $conn->connect_error);

}

echo "record created successfully";

$sql = "INSERT INTO checkout(firstname, email, address, city, state, zip, cardname, cardnumber, expmonth, expyear, cvv, sameadr) VALUES ('$x', '$y','$z','$a','$b' , '$c', '$d', '$e', '$f', '$g','$h', '$i')";



if ($conn->query($sql) === TRUE) {

    echo " proceed to check out";

}
else{

    echo "Error:" . $sql . "<br>" . $conn->error;
}

$conn->close();



?>
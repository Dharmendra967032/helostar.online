<?php
$x=$_POST['name'];
$y=$_POST['email'];
$z=$_POST['number'];
$a=$_POST['message'];

$servername = "localhost";
$username = "root";
$password =  "";
$dbname="db1";

$conn = new mysqli($servername, $username, $password, $dbname);


if ($conn->connect_error) {

    die("Connection failed: " . $conn->connect_error);

}

echo "message sent";

$sql = "INSERT INTO contact(name, email, number, message) VALUES ('$x', '$y', '$z', '$a')";



if ($conn->query($sql) === TRUE) {

    echo " successfully Return to Home page!!";

}
else{

    echo "Error:" . $sql . "<br>" . $conn->error;
}

$conn->close();



?>
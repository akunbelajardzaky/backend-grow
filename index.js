fetch("http://localhost:3000/blog?page=1&limit=5")
  .then(function (response) {
    // The API call was successful!
    return JSON.parse(response.json());
  })
  .then(function (data) {
    // This is the JSON from our response
    console.log(data);
  })
  .catch(function (err) {
    // There was an error
    console.warn("Something went wrong.", err);
  });

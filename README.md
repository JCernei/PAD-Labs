# PAD-Labs
Laboratory works for the PAD course


# Project Documentation

### Gateway Endpoints

The gateway has two main sets of endpoints: records and prescriptions.\
For a better experience, try the requests in the following order POST, GET, PUT, DELETE.

**-- Records Endpoints --**

> GET /records/id

Description: Retrieve the record with specified id.\
Parameters: id\
Example: http://localhost:8080/records/59

> POST /records/

Description: Create a new record.\
Request Body:
```json
{
    "name": "Morgue",
    "medical_history": "dead"
}
```
Example: http://localhost:8080/records/

> PUT /records/id

Description: Update the record with specified id.\
Request Body:
```json
{
    "updated_medical_history": "happy"
}
```
Example: http://localhost:8080/records/59

> DELETE /records/id

Description: Delete the record with specified id.\
Parameters: id\
Example: http://localhost:8080/records/59

> GET /records

Description: Retrieve a list of all records.\
Parameters: None\
Example: http://localhost:8080/records

**-- Prescriptions Endpoints --**

> GET /prescriptions/id

Description: Retrieve the prescription with specified id.\
Parameters: id\
Example: http://localhost:8080/prescriptions/8

> POST /prescriptions/

Description: Create a new prescription.\
Request Body:
```json
{
    "medication": "some pills"
}
```
Example: http://localhost:8080/prescriptions/

> PUT /prescriptions/id

Description: Update the prescription with specified id.\
Request Body:
```json
{
    "updated_medication": "some other pills"
}
```
Example: http://localhost:8080/prescriptions/3

> DELETE /prescriptions/id

Description: Delete the prescription with specified id.\
Parameters: id\
Example: http://localhost:8080/prescriptions/2

## Running the Project/Docker Images

To run the project, you only need to run the docker compose file from the branch images. This will allow you to run the project by using the Docker Images from docker hub. 

These are the steps
1. Go to branch images.

2. Copy the docker-compose.yaml file.

3. Run the project using the command:

    ```shell
    $ docker compose up
    ```

4. Access the endpoints using the provided URLs and request methods (GET, POST, PUT, DELETE) as described above. Test the endpoints by sending requests using tools like cURL or Postman, or by accessing them through a web browser.

Here is the [postman collection](PAD-labs.postman_collection.json)

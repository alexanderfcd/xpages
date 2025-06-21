# **Concept**

Xpages generates website/s from JSON (Array of objects). Each object inside the array is a sepparate website.
Example JSON: 
```
[
    {
        "targetFolder": "example-folder",
        "template": "default",
        "templateData": {
            
        }

    },
    {
        "targetFolder": "other-folder",
        "template": "other-template",
        "templateData": {}
    }
]
```
Each object inside the array must contain "targetFolder", "template", "templateData".
- targetFolder - folder in which the website will be stored after build
- template - folder of the template
- templateData - object which contains the wesbsite data. There is no limit to the structure of it. For example if you have
  ```"templateData": { "myCoolTitle": "Some title", "myData": {"firstName": "test"} }```,
  in you template you must refference to the title with <%= myCoolTitle %> and to "firstName" with <%= myData.firstName %>
  

# **Instalation**

    npm i
    npm i -g


# Usage CLI:

default render.json

    xpages 



## Custom path:

    xpages -j ./path/to/my.json
    xpages -json ./path/to/my.json


## Custom url:

    xpages -u https://example.com/data.json
    xpages -url https://example.com/data.json

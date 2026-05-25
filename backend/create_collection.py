import os 

import weaviate
from dotenv import load_dotenv
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.init import Auth

load_dotenv()

weaviate_url = os.environ["WEAVIATE_URL"]
weaviate_api_key = os.environ["WEAVIATE_API_KEY"]

client = weaviate.connect_to_weaviate_cloud(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

try:
    if client.collections.exists("Investigations"):
        print("Investigations collection already exists.")
    else:
        client.collections.create(
            name="Investigations",
            vector_config=Configure.Vectors.text2vec_weaviate(),
            properties=[
                Property(name="requirement_text", data_type=DataType.TEXT),
                Property(name="status", data_type=DataType.TEXT),
                Property(name="suppliers", data_type=DataType.TEXT),
                Property(name="created_at", data_type=DataType.TEXT),
                Property(name="message", data_type=DataType.TEXT),
            ],
        )
        print("Investigations collection created.")
finally:
    client.close()
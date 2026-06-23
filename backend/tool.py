from langchain.tools import tool
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv
import tavily
from rich import print



load_dotenv()


@tool
def get_web_content(query: str) -> str:
    """Search web for retrieving content from a given URL. Returns the titles, URLs, and snippets."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "Error: TAVILY_API_KEY not set in environment"

    client = TavilyClient(api_key=api_key)
    try:
        result = client.search(query, max_results=5, include_raw_content=True)
    except Exception as e:
        return f"Error calling Tavily API: {e}"

    out = []
    for r in result.get('results', []):
        out.append(f"Title: {r.get('title')}\nURL: {r.get('url')}\nSnippet: {r.get('content','')[:300]}\n")

    return "\n----\n".join(out)

# new = get_web_content.invoke("Recent news about war")

# print(new)


@tool
def scrape_url(url: str) -> str:
    """Scrape the content of a given URL and return the text."""
    try:
        response = requests.get(url,timeout=10,headers={'User-Agent': 'Mozilla/5.0'})
        # response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        for script in soup(["script", "style","nav","footer"]):
            script.decompose()
        return soup.get_text(separator='\n', strip=True)[:3000]
    except requests.RequestException as e:
        return f"Error fetching the URL: {e}"







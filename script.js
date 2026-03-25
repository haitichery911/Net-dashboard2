const API_KEYS = {
EUR:"ECBDFR",
GBP:"BOERUKM",
JPY:"IRSTCI01JPM156N",
AUD:"IRSTCI01AUM156N",
CAD:"IRSTCI01CAM156N"
}

function calculateBias(base,quote){

if(base>quote) return "Bullish"
if(base<quote) return "Bearish"

return "Neutral"

}

async function buildCurrency(currency){

let price = "-"
let news = await getNews()
let interest = "-"

if(currency !== "GOLD"){
interest = await getInterest(series[currency])
price = await getPrice(`${currency}/USD`)
}

if(currency === "GOLD"){
price = await getPrice("XAU/USD")
}

let bias = "Neutral"

if(interest > 3 && news === "Bullish") bias = "Bullish"
if(interest < 2 && news === "Bearish") bias = "Bearish"

const card = document.createElement("div")
card.className="card"

card.innerHTML=`

<h2>${currency}</h2>

<div class="data">

Price: ${price} <br>
Interest Rate: ${interest}% <br>
News Sentiment: ${news} <br>

<div class="bias ${bias.toLowerCase()}">
${bias}
</div>

</div>

`

return card

}

async function load(){

const dashboard=document.getElementById("dashboard")

dashboard.innerHTML=""

for(let currency of currencies){

const card = await buildCurrency(currency)

dashboard.appendChild(card)

}

}

}

load()

setInterval(load,300000)

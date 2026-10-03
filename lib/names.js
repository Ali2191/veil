/* VEIL — lexicons used by the name detector. All entries are lowercase. */
(function (root) {
  'use strict';
  const set = (s) => new Set(s.trim().split(/\s+/));

  // Common given names across South Asian, Arabic, English, European and East Asian usage.
  const FIRST = set(`
    muhammad mohammad mohammed muhammed mohamed ahmed ahmad ali hassan hasan hussain husain hussein usman osman umar omar
    bilal hamza zain tayyab talha saad fahad fahd faisal imran kamran asad asif arif adnan adeel adil aamir amir anwar
    arshad ashraf atif azhar babar danish ehsan farhan faraz fawad haris haider hamid haroon harun iftikhar irfan jawad
    junaid kashif khalid khurram mansoor mansur mohsin moiz nabeel nabil naeem nasir naveed nadeem nauman noman obaid
    owais qasim rafay rashid rehan rizwan saqib salman sajid shahid shahzad shehzad shoaib sohail sufyan tahir tariq
    tarek umair usama osama waqas waseem wasim waleed walid yasir yousaf yusuf youssef zahid zeeshan zubair ibrahim
    ismail idrees abdullah abdul abubakar ayaan rayyan arham ahsan shayan mustafa mostafa murtaza mujtaba raza rehman
    sheraz taimur taha uzair wahab zaid zaheer zafar jahangir javed javaid pervaiz parvez aslam akram akbar nawaz hammad
    hamad ammar anas aqib aqeel awais daniyal fazal ghulam habib hafeez hanif ijaz inam iqbal jamal jamil kaleem kamal
    karim kareem latif mahmood mahmoud majid maqsood masood mubashir mudassar muneeb musa naeem naseer nisar qadir
    rafiq rahim rauf saeed sahil samad sarfraz shafiq shakeel shamim sharif shaukat sikandar sultan tanveer tauseef
    touseef ubaid wajid yaqoob yasin zohaib zeshan azeem aziz abid aftab ahtesham arsalan azam basit burhan
    fatima fatimah ayesha aisha aysha maryam mariam zainab khadija khadijah sana hina amna sara sarah iqra mahnoor
    areeba hira rabia saima nadia farah mehwish sadia uzma bushra asma samina shazia rubina nazia anam aliza alishba
    eman laiba zoya aiza anaya ayat hafsa humaira javeria kinza komal maham maira mehak mishal momina nimra rida
    rimsha sabahat sadaf saba samra sehar sidra sobia tahira urooj zara zahra zunaira shabnam parveen nasreen
    yasmin yasmeen yasmine salma mona huda rania dina reem noura nour layla leila lina amira samira jana dana
    rahul rohit amit anil arjun aarav vivek vikram rajesh ramesh suresh sanjay sunil deepak priya pooja neha anjali
    divya kavya sneha aditi ananya shreya riya nisha ravi karan rohan manish nikhil pradeep ajay vijay sachin harish
    ganesh lakshmi meera sunita anita arun varun siddharth aditya abhishek akash rakesh mahesh dinesh naresh prakash
    gaurav saurabh ankit ankita swati shweta preeti aishwarya rajiv sameer samir
    james john robert michael william david richard joseph thomas charles christopher daniel matthew anthony donald
    steven stephen paul andrew joshua kenneth kevin brian george edward ronald timothy jason jeffrey ryan jacob gary
    nicholas eric jonathan larry justin scott brandon benjamin samuel gregory alexander raymond patrick dennis jerry
    tyler aaron jose henry adam douglas nathan peter zachary kyle walter harold jeremy ethan carl keith roger gerald
    christian terry sean arthur austin noah lawrence jesse bryan billy jordan albert dylan bruce willie gabriel alan
    juan logan wayne ralph roy eugene randy vincent russell louis philip bobby johnny bradley liam oliver lucas mason
    elijah leo owen luke isaac caleb nathaniel tom tim mike chris dave dan matt nick alex sam ben josh jim bob steve
    tony andy jake harry charlie oscar freddie archie theo max finn jamie connor callum ewan rory declan
    mary patricia jennifer linda elizabeth barbara susan jessica karen lisa nancy betty margaret sandra ashley
    kimberly emily donna michelle carol amanda dorothy melissa deborah stephanie rebecca sharon laura cynthia kathleen
    amy angela shirley anna brenda pamela emma nicole helen samantha katherine christine debra rachel carolyn janet
    catherine maria heather diane ruth julie olivia joyce virginia victoria kelly lauren christina joan evelyn judith
    megan andrea cheryl hannah jacqueline martha gloria teresa ann anne sara madison frances kathryn janice jean
    abigail alice judy sophia julia isabella charlotte amelia mia harper ella chloe zoe lily natalie jane kate lucy
    sophie jenny claire fiona emilia ava isla freya poppy evie ruby daisy jessica holly
    carlos luis miguel javier alejandro diego pablo sofia lucia valentina camila isabel elena carmen francisco
    antonio manuel pedro jorge ricardo fernando rafael andres mateo santiago gabriela daniela mariana paula
    hans klaus stefan andreas markus lukas jan pierre jean francois marie camille chloe giulia giuseppe marco luca
    matteo alessandro francesca chiara ivan dmitri sergei olga natasha irina anastasia
    wei jun ming hiroshi yuki takeshi haruto sakura kenji jia hao yan mei ling chen min seo ji hye jin
    zia zaki zakir nouman shams sheharyar shehryar ubaidullah
    rubab hoorain sumaira shumaila tehreem farwa ifrah ruqaiya kainat minahil pakeeza shagufta zubaida shahzaib haseeb hashir
    huzaifa mudassir raheel sohaib subhan taimoor waqar affan ashir azan ehtisham hanzala irtaza jibran luqman mazhar moeen
    riaz rohail shahbaz shakir touqeer waheed wajahat zaman suman manoj
    kwame kofi ama chinedu ngozi oluwaseun tunde emeka amara zanele thabo
  `);

  // Given names that are also everyday English words: only treated as names
  // when followed by a surname or introduced by a strong cue.
  const AMBIGUOUS = set(`
    will may june april august mark grace hope faith joy rose bill pat jack frank sunny summer amber iman noor
    sami shan wade drew chase hunter mason carter price rich art guy victor lane dawn eve ray rob sue don ken
    penny ruby holly daisy lily jean max sky storm sage jay dean hazel iris violet river
  `);

  const SURNAMES = set(`
    khan ali ahmed ahmad shah malik butt qureshi chaudhry chaudhary chaudhri choudhry sheikh shaikh siddiqui hussain
    raza iqbal akhtar rana mirza baig awan abbasi jutt bhatti rajput javed hashmi gillani gilani bukhari naqvi rizvi
    zaidi kazmi jafri jaffri farooqi usmani ansari khattak afridi yousafzai durrani niazi cheema warraich gondal
    sandhu randhawa tareen tarin lodhi lodi memon baloch bajwa ghauri ghouri kiyani kayani janjua khawaja khwaja
    sharif nawaz rehman rahman hassan hasan haider aslam anwar arshad saeed mehmood mahmood latif akram
    sharma verma gupta singh patel kumar reddy rao iyer nair mehta jain joshi kapoor khanna malhotra chopra das
    bose banerjee chatterjee mukherjee agarwal aggarwal bhatt desai pandey mishra tiwari yadav chauhan thakur
    smith johnson williams brown jones garcia miller davis rodriguez martinez hernandez lopez gonzalez wilson
    anderson taylor thomas moore jackson martin lee thompson white harris clark lewis robinson walker young allen
    king wright scott hill green adams baker nelson carter mitchell roberts turner phillips campbell parker evans
    edwards collins stewart morris murphy cook rogers morgan cooper peterson reed bailey bell kelly howard ward cox
    richardson wood watson brooks bennett gray grey james hughes price sanders myers long ross foster powell jenkins
    perry russell sullivan fisher henderson coleman simmons patterson jordan reynolds hamilton graham wallace
    nguyen tran pham wang chen zhang liu yang huang zhao wu zhou xu sun kim park choi jung kang cho tanaka suzuki
    sato watanabe yamamoto nakamura kobayashi mueller muller schmidt schneider fischer weber meyer wagner becker
    rossi russo ferrari esposito bianchi romano ivanov petrov smirnov silva santos oliveira pereira costa
    haq hameed rasheed nadeem naeem khalil saleem shafi yousuf
    tarrar sial mughal pathan khokhar ranjha dogar marwat mehsud wazir kakar achakzai bugti marri mengal raisani jamali leghari
    mazari khosa dasti gabol talpur chandio bhutto zardari
    fernandes okafor okonkwo adeyemi mensah
  `);

  // Lower-case particles allowed inside a name ("Zia ul Haq", "Muhammad bin Qasim").
  const PARTICLES = set(`bin binti bint ibn ul ud al el van von der de da di del della la le du`);

  // Honorifics that introduce a name.
  const TITLES = set(`mr mrs ms miss mx dr prof professor sir madam madame dame lord lady engr eng hon rev fr sr jr syed sayed sheikh hafiz haji hajji mian`);

  // Capitalized words that are never part of a person's name. Covers sentence
  // starters, roles, calendar words, and address/organization vocabulary.
  const NOT_NAME = set(`
    i i'm i'd i'll i've a an the my your our their his her its it this that these those we you they he she me us
    them hi hello hey dear greetings thanks thank please kindly regards best sincerely cheers yes no ok okay also
    and but or so if when what why how where who whom whose which while write tell send make help can could would
    should will shall may might must do does did is are was were be been have has had let let's lets here there
    now then today tomorrow yesterday tonight after before during since until about above below from to in on at
    by for of with without into onto over under again once just only not all any each every some many much more
    most other such same own than too very one two three four five six seven eight nine ten first second third
    next last new old good great bad high low big small long short customer client user admin manager team support
    staff member landlord tenant owner seller buyer driver doctor nurse teacher student professor officer agent
    director ceo cto cfo president chairman hr sir madam everyone everybody anyone someone all friend friends
    colleague colleagues world subject re fwd fw cc bcc attn note ps name email phone mobile address number account
    id card passport date dob city state country street st road rd avenue ave lane ln block sector phase colony
    town society house plot flat apartment suite unit floor building bank university college school hospital
    company inc ltd llc corp limited pvt group monday tuesday wednesday thursday friday saturday sunday january
    february march april june july august september october november december jan feb mar apr jun jul aug sep sept
    oct nov dec mon tue wed thu fri sat sun am pm north south east west central new english urdu arabic hindi
    islam muslim christian god allah insha inshallah ramadan eid christmas google microsoft apple amazon meta
    openai chatgpt gpt claude gemini copilot perplexity grok llama mistral deepseek windows linux android iphone
    ios mac macos chrome firefox safari python javascript java typescript react node sql html css api json
    pakistan india china usa uk america england london paris dubai lahore karachi islamabad multan rawalpindi
    peshawar quetta faisalabad hyderabad sialkot gujranwala delhi mumbai dhaka
    ask call meet message text ping inform notify remind invite forward reply schedule book pay visit see give
    show find get take bring told asked met called saw said says wrote sent gave paid contact draft create
    explain summarize translate review check fix update add remove use using thanks welcome sorry congrats
    mera meri mere naam name hai hain aur ka ki ke ko se mein main hun hoon tha thi the nahi nahin bhi kal aaj ab yeh woh
    is us ye wo kya kyun kaise kahan janab sahab sahib bhai baji apa aapi bhabhi message karo kar karna bhej bhejo batao
  `);

  const api = { FIRST, AMBIGUOUS, SURNAMES, PARTICLES, TITLES, NOT_NAME };
  root.VeilNames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
